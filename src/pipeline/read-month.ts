import type { FxClient } from "@/adapters/fx/types";
import type { ModelClient } from "@/adapters/model/types";
import type { CategoryResult } from "@/core/categories";
import { checkCurrency, type FxRate } from "@/core/currency";
import { checkQuality, type QualityResult } from "@/core/quality";
import {
  BASE_CURRENCY,
  type Extraction,
  type ReceiptIntake,
  type StatementLine,
} from "@/core/schemas";
import type { PipelineConfig } from "./config";
import type { RunLog } from "./run-log";
import { categoriseReceipt } from "./stages/categorise";
import { extractReceipt } from "./stages/extract";

// The I/O half of the month pipeline (04): quality gate, extraction, and category per receipt,
// then one FX range fetch per foreign currency. It records what was read, nothing more: every
// exception, match, and status is derived afterwards by `reconcileMonth` (pure), which runs
// again after each human decision without calling the model.

export interface MonthInput {
  monthKey: string;
  receipts: ReceiptIntake[];
  statementLines: StatementLine[];
  /** The detected statement layout, shown on the review page. */
  statementFormat?: string;
  /** Folder the receipts' `file.path` is relative to, from the app's working directory. */
  fileRoot?: string;
  readFile: (receipt: ReceiptIntake) => Promise<Buffer>;
}

/** What the pipeline read for one receipt. */
export interface ReadReceipt {
  intake: ReceiptIntake;
  gate: QualityResult;
  /** Why extraction failed (after the validation retry), or null. */
  extractFailure: string | null;
  extraction: Extraction | null;
  /** Null when the receipt never reached categorisation (unreadable, not a receipt). */
  category: CategoryResult | null;
}

/** A stored month: the input and what was read. Decisions are stored separately. */
export interface MonthSnapshot {
  version: 2;
  runId: string;
  monthKey: string;
  mode: "live" | "replay";
  startedAt: string;
  finishedAt: string;
  statementFormat: string | null;
  fileRoot: string | null;
  statementLines: StatementLine[];
  rates: FxRate[];
  receipts: ReadReceipt[];
}

export interface ReadDeps {
  model: ModelClient;
  fx: FxClient;
  config: PipelineConfig;
  runId: string;
  log: RunLog;
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

/** One range fetch for a foreign currency, logged (R-CUR-2). Returns no rates on failure. */
export async function fetchRates(
  currency: string,
  monthKey: string,
  deps: Pick<ReadDeps, "fx" | "log">,
): Promise<FxRate[]> {
  const range = fxRange(monthKey);
  const started = performance.now();
  const fetched = await deps.fx.getRates(currency, range.from, range.to);
  deps.log.add({
    receiptId: null,
    stage: "fx",
    status: fetched.length > 0 ? "ok" : "fallback",
    durationMs: Math.round(performance.now() - started),
    errorCode: fetched.length > 0 ? null : "FX_NO_RATES",
  });
  return fetched;
}

export async function readMonth(input: MonthInput, deps: ReadDeps): Promise<MonthSnapshot> {
  const startedAt = new Date().toISOString();
  const { config, log } = deps;
  const modelDeps = { model: deps.model, effort: config.effort, log };

  const receipts = await mapLimit(input.receipts, 4, async (intake): Promise<ReadReceipt> => {
    const read: ReadReceipt = {
      intake,
      gate: checkQuality(intake.file, config.qualityPolicy),
      extractFailure: null,
      extraction: null,
      category: null,
    };
    log.add({
      receiptId: intake.id,
      stage: "quality",
      status: read.gate.ok ? "ok" : "fallback",
      durationMs: 0,
      errorCode: read.gate.ok ? null : "QUALITY_GATE",
    });
    if (!read.gate.ok) return read;

    const extracted = await extractReceipt(
      {
        receiptId: intake.id,
        filename: intake.file.path.split("/").pop() ?? intake.id,
        mime: intake.file.mime,
        data: await input.readFile(intake),
        sha256: intake.file.sha256,
      },
      { ...modelDeps, modelId: config.modelExtract, minConfidence: config.extractConfidenceMin },
    );
    if (!extracted.ok) {
      read.extractFailure = extracted.reason;
      return read;
    }
    read.extraction = extracted.extraction;
    if (!extracted.extraction.isReceipt) return read;

    read.category = await categoriseReceipt(
      {
        receiptId: intake.id,
        vendor: extracted.extraction.vendor.value,
        summary: extracted.extraction.summary.value,
      },
      {
        ...modelDeps,
        modelId: config.modelCategorise,
        config: config.categories,
        minConfidence: config.categoryConfidenceMin,
      },
    );
    return read;
  });

  // FX: one range fetch per foreign currency in the month (R-CUR-2).
  const foreign = new Set<string>();
  for (const r of receipts) {
    if (!r.extraction?.isReceipt) continue;
    const { currency } = checkCurrency(r.extraction.currency, config.extractConfidenceMin);
    if (currency && currency !== BASE_CURRENCY) foreign.add(currency);
  }
  const rates: FxRate[] = [];
  for (const currency of [...foreign].sort()) {
    rates.push(...(await fetchRates(currency, input.monthKey, deps)));
  }

  return {
    version: 2,
    runId: deps.runId,
    monthKey: input.monthKey,
    mode: deps.model.mode,
    startedAt,
    finishedAt: new Date().toISOString(),
    statementFormat: input.statementFormat ?? null,
    fileRoot: input.fileRoot ?? null,
    statementLines: input.statementLines,
    rates,
    receipts,
  };
}
