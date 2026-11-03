import type { FxClient } from "@/adapters/fx/types";
import type { ModelClient, ReasoningEffort } from "@/adapters/model/types";
import type { Env } from "@/config/env";
import type { CategoryConfig, CategoryResult } from "@/core/categories";
import {
  type Conversion,
  checkCurrency,
  convertToAud,
  type FxRate,
  summariseExcluded,
} from "@/core/currency";
import { findDuplicates } from "@/core/duplicates";
import {
  linesWithoutReceipt,
  type MatchOutcome,
  type MatchPolicy,
  matchReceipts,
} from "@/core/matching";
import { fromCents, toCents } from "@/core/money";
import { checkIsReceipt, checkQuality, type QualityPolicy } from "@/core/quality";
import { orderQueue, type QueueItem, type QueueSection } from "@/core/queue";
import { deriveReceiptState, type ReceiptState } from "@/core/receipt-state";
import { checkBusinessPurpose, paymentSourceLabel } from "@/core/required";
import {
  BASE_CURRENCY,
  type ExceptionCode,
  type Extraction,
  type ReceiptIntake,
  type StatementLine,
} from "@/core/schemas";
import { RunLog, type RunLogRow } from "./run-log";
import { categoriseReceipt } from "./stages/categorise";
import { extractReceipt } from "./stages/extract";

// The month pipeline (04): quality gate -> extract -> categorise per receipt, then FX,
// duplicates, matching, exceptions, and queue order for the month. The pipeline orchestrates;
// every money decision is a src/core function.

export interface PipelineConfig {
  matchPolicy: MatchPolicy;
  qualityPolicy: QualityPolicy;
  extractConfidenceMin: number;
  categoryConfidenceMin: number;
  modelExtract: string;
  modelCategorise: string;
  effort: ReasoningEffort;
  categories: CategoryConfig;
}

export function configFromEnv(env: Env, categories: CategoryConfig): PipelineConfig {
  return {
    matchPolicy: {
      pctThreshold: env.AMOUNT_DIFF_PCT_THRESHOLD,
      audThreshold: env.AMOUNT_DIFF_AUD_THRESHOLD,
      minScore: env.AUTO_MATCH_MIN_SCORE,
      minMargin: env.AUTO_MATCH_MIN_MARGIN,
    },
    qualityPolicy: {
      minLongSide: env.QUALITY_MIN_LONG_SIDE,
      minShortSide: env.QUALITY_MIN_SHORT_SIDE,
    },
    extractConfidenceMin: env.EXTRACT_CONFIDENCE_MIN,
    categoryConfidenceMin: env.CATEGORY_CONFIDENCE_MIN,
    modelExtract: env.MODEL_EXTRACT,
    modelCategorise: env.MODEL_CATEGORISE,
    effort: env.MODEL_REASONING_EFFORT,
    categories,
  };
}

export interface MonthInput {
  monthKey: string;
  receipts: ReceiptIntake[];
  statementLines: StatementLine[];
  readFile: (receipt: ReceiptIntake) => Promise<Buffer>;
}

export interface PipelineDeps {
  model: ModelClient;
  fx: FxClient;
  config: PipelineConfig;
  runId: string;
}

export interface ReceiptResult {
  id: string;
  submitterId: string;
  paymentSource: string;
  paymentSourceLabel: string;
  businessPurpose: string | null;
  filePath: string;
  extraction: Extraction | null;
  lowConfidenceFields: string[];
  /** Why the item needs a person, in plain language, beyond its exception codes. */
  notes: string[];
  conversion: Conversion | null;
  category: CategoryResult | null;
  duplicateOf: string | null;
  match: MatchOutcome | null;
  /** R-AMT-3 badge: charged minus receipt, in the compared currency, when it is a small difference. */
  difference: { amount: number; currency: string } | null;
  state: ReceiptState;
}

export interface MonthResult {
  runId: string;
  monthKey: string;
  mode: "live" | "replay";
  startedAt: string;
  finishedAt: string;
  receipts: ReceiptResult[];
  /** R-MAT-7: statement lines with no receipt, before any human decision. */
  noReceiptLines: StatementLine[];
  queue: QueueSection[];
  totals: {
    ledgerAud: number;
    /** R-CUR-3: excluded amounts by currency, not just a count. */
    excludedFx: { currency: string; amount: number; count: number }[];
  };
  log: RunLogRow[];
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

function shiftDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** FX range for a month: 7 days before it starts (R-CUR-2 lookback) to its last day. */
export function fxRange(monthKey: string): { from: string; to: string } {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 1)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(year ?? 0, month ?? 1, 0)).toISOString().slice(0, 10);
  return { from: shiftDays(first, -7), to: last };
}

interface ReadStage {
  intake: ReceiptIntake;
  exceptions: ExceptionCode[];
  notes: string[];
  extraction: Extraction | null;
  lowConfidenceFields: string[];
  currency: string | null;
  category: CategoryResult | null;
  readable: boolean; // passed the gate, extracted, and is a receipt
}

export async function runMonth(input: MonthInput, deps: PipelineDeps): Promise<MonthResult> {
  const startedAt = new Date().toISOString();
  const { config } = deps;
  const log = new RunLog(deps.runId);
  const modelDeps = { model: deps.model, effort: config.effort, log };

  // Per receipt: quality gate, extraction, category.
  const read = await mapLimit(input.receipts, 4, async (intake): Promise<ReadStage> => {
    const stage: ReadStage = {
      intake,
      exceptions: [...checkBusinessPurpose(intake.businessPurpose)],
      notes: [],
      extraction: null,
      lowConfidenceFields: [],
      currency: null,
      category: null,
      readable: false,
    };

    const quality = checkQuality(intake.file, config.qualityPolicy);
    log.add({
      receiptId: intake.id,
      stage: "quality",
      status: quality.ok ? "ok" : "fallback",
      durationMs: 0,
      errorCode: quality.ok ? null : "QUALITY_GATE",
    });
    if (!quality.ok) {
      stage.exceptions.push(quality.exception);
      stage.notes.push(quality.reason);
      return stage;
    }

    const data = await input.readFile(intake);
    const extracted = await extractReceipt(
      {
        receiptId: intake.id,
        filename: intake.file.path.split("/").pop() ?? intake.id,
        mime: intake.file.mime,
        data,
        sha256: intake.file.sha256,
      },
      { ...modelDeps, modelId: config.modelExtract, minConfidence: config.extractConfidenceMin },
    );
    if (!extracted.ok) {
      stage.exceptions.push("UNREADABLE");
      stage.notes.push(extracted.reason);
      return stage;
    }

    const e = extracted.extraction;
    stage.extraction = e;
    stage.lowConfidenceFields = extracted.lowConfidenceFields;
    if (extracted.lowConfidenceFields.length > 0) stage.exceptions.push("LOW_CONFIDENCE_FIELD");
    const notReceipt = checkIsReceipt(e.isReceipt);
    stage.exceptions.push(...notReceipt);
    if (notReceipt.length > 0) return stage;

    const currency = checkCurrency(e.currency, config.extractConfidenceMin); // R-CUR-5
    stage.currency = currency.currency;
    stage.exceptions.push(...currency.exceptions);
    stage.readable = true;

    stage.category = await categoriseReceipt(
      { receiptId: intake.id, vendor: e.vendor.value, summary: e.summary.value },
      {
        ...modelDeps,
        modelId: config.modelCategorise,
        config: config.categories,
        minConfidence: config.categoryConfidenceMin,
      },
    );
    stage.exceptions.push(...stage.category.exceptions);
    return stage;
  });

  // FX: one range fetch per foreign currency in the month (R-CUR-2).
  const rates: FxRate[] = [];
  const range = fxRange(input.monthKey);
  const foreign = [
    ...new Set(
      read.flatMap((r) => (r.currency && r.currency !== BASE_CURRENCY ? [r.currency] : [])),
    ),
  ];
  for (const currency of foreign.sort()) {
    const started = performance.now();
    const fetched = await deps.fx.getRates(currency, range.from, range.to);
    rates.push(...fetched);
    log.add({
      receiptId: null,
      stage: "fx",
      status: fetched.length > 0 ? "ok" : "fallback",
      durationMs: Math.round(performance.now() - started),
      errorCode: fetched.length > 0 ? null : "FX_NO_RATES",
    });
  }
  const conversions = new Map<string, Conversion>();
  for (const r of read) {
    const total = r.extraction?.total.value;
    const date = r.extraction?.date.value;
    if (!r.readable || total == null || !r.currency || !date) continue;
    const conversion = convertToAud(total, r.currency, date, rates);
    conversions.set(r.intake.id, conversion);
    if (conversion.status === "unavailable") r.exceptions.push(conversion.exception);
  }

  // Duplicates (R-DUP-1/2), over every upload so a re-uploaded unreadable file is still caught.
  const duplicates = findDuplicates(
    read.map((r) => ({
      id: r.intake.id,
      uploadOrder: r.intake.uploadOrder,
      fileHash: r.intake.file.sha256,
      vendor: r.extraction?.vendor.value ?? null,
      date: r.extraction?.date.value ?? null,
      total: r.extraction?.total.value ?? null,
      currency: r.currency,
    })),
  );
  log.add({ receiptId: null, stage: "duplicates", status: "ok", durationMs: 0 });
  for (const r of read) if (duplicates.has(r.intake.id)) r.exceptions.push("DUPLICATE");

  // Matching: readable receipts that are not duplicates (R-MAT).
  const matchable = read.filter((r) => r.readable && !duplicates.has(r.intake.id));
  const started = performance.now();
  const outcomes = matchReceipts(
    matchable.map((r) => {
      const conversion = conversions.get(r.intake.id);
      return {
        id: r.intake.id,
        total: r.extraction?.total.value ?? null,
        currency: r.currency,
        totalAud: conversion && conversion.status !== "unavailable" ? conversion.amountAud : null,
        date: r.extraction?.date.value ?? null,
        vendor: r.extraction?.vendor.value ?? null,
        paymentSource: r.intake.paymentSource,
      };
    }),
    input.statementLines,
    input.monthKey,
    config.matchPolicy,
  );
  log.add({
    receiptId: null,
    stage: "match",
    status: "ok",
    durationMs: Math.round(performance.now() - started),
  });
  const matchById = new Map(outcomes.map((o) => [o.receiptId, o]));
  const lineById = new Map(input.statementLines.map((l) => [l.id, l]));

  // Derived state, per receipt.
  const receipts: ReceiptResult[] = read.map((r) => {
    const match = matchById.get(r.intake.id) ?? null;
    const conversion = conversions.get(r.intake.id) ?? null;
    const line = match?.statementLineId ? lineById.get(match.statementLineId) : undefined;
    const chosen = match?.candidates.find((c) => c.statementLineId === match.statementLineId);
    const state = deriveReceiptState({
      exceptions: [...r.exceptions, ...(match?.exceptions ?? [])],
      match,
      matchedLineAmountAud: line?.amountAud ?? null,
      receiptAmountAud:
        conversion && conversion.status !== "unavailable" ? conversion.amountAud : null,
      duplicate: duplicates.has(r.intake.id),
    });
    return {
      id: r.intake.id,
      submitterId: r.intake.submitterId,
      paymentSource: r.intake.paymentSource,
      paymentSourceLabel: paymentSourceLabel(r.intake.paymentSource),
      businessPurpose: r.intake.businessPurpose?.trim() || null,
      filePath: r.intake.file.path,
      extraction: r.extraction,
      lowConfidenceFields: r.lowConfidenceFields,
      notes: r.notes,
      conversion,
      category: r.category,
      duplicateOf: duplicates.get(r.intake.id)?.duplicateOf ?? null,
      match,
      difference:
        chosen?.amount?.kind === "small"
          ? { amount: chosen.amount.difference, currency: chosen.amount.comparedIn }
          : null,
      state,
    };
  });

  const noReceiptLines = linesWithoutReceipt(
    input.statementLines,
    receipts.flatMap((r) => (r.match?.statementLineId ? [r.match.statementLineId] : [])),
  );
  const queueItems: QueueItem[] = [
    ...receipts.map(
      (r): QueueItem => ({
        kind: "receipt",
        id: r.id,
        status: r.state.status,
        exceptions: r.state.exceptions,
        reimbursement: r.state.reimbursement,
        amountAud:
          r.state.ledgerAmountAud ??
          (r.conversion && r.conversion.status !== "unavailable" ? r.conversion.amountAud : null),
      }),
    ),
    ...noReceiptLines.map(
      (l): QueueItem => ({ kind: "no_receipt_line", id: l.id, amountAud: l.amountAud }),
    ),
  ];
  const ledgerCents = receipts.reduce(
    (sum, r) => sum + (r.state.excludedFromTotals ? 0 : toCents(r.state.ledgerAmountAud ?? 0)),
    0,
  );

  return {
    runId: deps.runId,
    monthKey: input.monthKey,
    mode: deps.model.mode,
    startedAt,
    finishedAt: new Date().toISOString(),
    receipts,
    noReceiptLines,
    queue: orderQueue(queueItems),
    totals: {
      ledgerAud: fromCents(ledgerCents),
      excludedFx: summariseExcluded([...conversions.values()]),
    },
    log: log.rows,
  };
}
