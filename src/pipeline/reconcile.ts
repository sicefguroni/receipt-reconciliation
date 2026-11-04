import { type CategoryResult, categoriseByRules } from "@/core/categories";
import { type Conversion, checkCurrency, convertToAud, summariseExcluded } from "@/core/currency";
import { findDuplicates } from "@/core/duplicates";
import {
  applyChosenLines,
  type Candidate,
  combinedPayment,
  isCredit,
  linesWithoutReceipt,
  type MatchOutcome,
  type MatchReceipt,
  MIN_CANDIDATE_SCORE,
  matchReceipts,
  pairingConcerns,
} from "@/core/matching";
import { fromCents, toCents } from "@/core/money";
import { checkIsReceipt } from "@/core/quality";
import { orderQueue, type QueueItem, type QueueSection } from "@/core/queue";
import { deriveReceiptState, type ReceiptState } from "@/core/receipt-state";
import { checkBusinessPurpose, paymentSourceLabel } from "@/core/required";
import {
  BASE_CURRENCY,
  type CorrectableField,
  type Decision,
  type ExceptionCode,
  type Extraction,
  PaymentSource,
  type StatementLine,
} from "@/core/schemas";
import type { PipelineConfig } from "./config";
import type { MonthSnapshot, ReadReceipt } from "./read-month";
import type { RunLogRow } from "./run-log";
import { lowConfidenceFields } from "./stages/extract";

// The pure half of the month pipeline: what was read, plus every human decision so far, in,
// the month's derived state out (exceptions, matches, statuses, queue, totals). It runs after
// each decision, so a status is never stored or hand-picked: it is always derived again
// (CLAUDE.md non-negotiable 3; R-MAT-5).

export interface Stamp {
  by: string;
  at: string;
  reason: string | null;
}

export type ReceiptOutcome = "open" | "approved" | "duplicate_confirmed" | "removed";

export interface ReceiptResult {
  id: string;
  submitterId: string;
  paymentSource: PaymentSource;
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
  /** Exceptions still waiting for a person. Empty once the item is done. */
  openExceptions: ExceptionCode[];
  outcome: ReceiptOutcome;
  /** Fields a person changed or confirmed. */
  corrected: CorrectableField[];
  enteredByHand: boolean;
  /** R-MAT-6 (Day 4, C1): what does not fit between the receipt and its payment, if anything. */
  concerns: string[];
  /** What matching used for this receipt (null when it was not readable): the decision checks judge a person's pairing on the same numbers (R-MAT-11). */
  matchInput: MatchReceipt | null;
  signOff: Stamp | null;
  approval: Stamp | null;
}

export type LineResolution =
  | { kind: "substitute"; category: string; stamp: Stamp }
  | { kind: "not_expense"; stamp: Stamp };

export interface NoReceiptLine {
  line: StatementLine;
  resolution: LineResolution | null;
  /**
   * Open receipts that list this line as a candidate. Shown as "possible match", so the line
   * is linked rather than written off as "not an expense" (TC04's line is both).
   */
  candidateFor: string[];
}

export interface ExceptionLogRow {
  itemId: string;
  itemKind: "receipt" | "statement_line";
  code: ExceptionCode | "NO_RECEIPT";
  open: boolean;
  /** How it was resolved, in plain language, or what is still needed. */
  resolution: string;
  stamp: Stamp | null;
}

export interface MonthResult {
  runId: string;
  monthKey: string;
  mode: "live" | "replay";
  startedAt: string;
  finishedAt: string;
  statementFormat: string | null;
  receipts: ReceiptResult[];
  /** R-MAT-7: statement lines with no receipt after matching and decisions, resolved or not. */
  noReceipt: NoReceiptLine[];
  /** Back-compatible view for the eval: the no-receipt lines' statement lines. */
  noReceiptLines: StatementLine[];
  /** Lines a person may still choose for a receipt: not matched, not resolved, not a credit. */
  freeLines: StatementLine[];
  statementLines: StatementLine[];
  queue: QueueSection[];
  /** Items needing nothing more: approved, confirmed duplicates, removed, resolved lines. */
  done: QueueItem[];
  closed: boolean;
  exceptionLog: ExceptionLogRow[];
  totals: {
    /** Receipts in the ledger plus substitutes for lines with no receipt. */
    ledgerAud: number;
    approvedAud: number;
    /** R-CUR-3: excluded amounts by currency, not just a count. */
    excludedFx: { currency: string; amount: number; count: number }[];
  };
  log: RunLogRow[];
  decisionCount: number;
}

const EXTRACTION_FIELDS = ["vendor", "date", "total", "currency", "tax", "summary"] as const;
type ExtractionField = (typeof EXTRACTION_FIELDS)[number];
const REQUIRED_BY_HAND: readonly ExtractionField[] = ["vendor", "date", "total", "currency"];

interface Correction {
  value: string | null;
  stamp: Stamp;
}

/** Each receipt's decisions folded in order: the latest of each kind wins. */
interface ReceiptEffects {
  fields: Map<CorrectableField, Correction>;
  /**
   * A human match: a line, or null for "reimburse, no statement line"; plus further lines for a
   * split payment (R-MAT-10). `seq` orders conflicts.
   */
  pin: { lineId: string | null; extraLineIds: string[]; seq: number } | null;
  signOff: { lineId: string; stamp: Stamp } | null;
  duplicate: { duplicate: boolean; stamp: Stamp } | null;
  removed: Stamp | null;
  approval: Stamp | null;
  decisions: Decision[];
}

function stampOf(d: Decision): Stamp {
  return { by: d.actorId, at: d.at, reason: d.reason ?? null };
}

function foldDecisions(decisions: readonly Decision[]) {
  const receipts = new Map<string, ReceiptEffects>();
  const lines = new Map<string, LineResolution | null>();
  const effectsOf = (id: string): ReceiptEffects => {
    let e = receipts.get(id);
    if (!e) {
      e = {
        fields: new Map(),
        pin: null,
        signOff: null,
        duplicate: null,
        removed: null,
        approval: null,
        decisions: [],
      };
      receipts.set(id, e);
    }
    return e;
  };

  decisions.forEach((d, seq) => {
    const stamp = stampOf(d);
    switch (d.action) {
      case "correct_field":
        effectsOf(d.subjectId).fields.set(d.after.field, { value: d.after.value, stamp });
        break;
      case "choose_match":
        effectsOf(d.subjectId).pin = { lineId: d.after.statementLineId, extraLineIds: [], seq };
        break;
      case "split_payment": {
        const [first, ...extra] = d.after.statementLineIds;
        effectsOf(d.subjectId).pin = { lineId: first ?? null, extraLineIds: extra, seq };
        break;
      }
      case "approve": {
        // An approved item keeps the match it was approved with.
        const e = effectsOf(d.subjectId);
        e.approval = stamp;
        if (d.after.statementLineId !== null || d.after.reimbursement) {
          // A split keeps its other lines: approval records the first, which is unchanged.
          const extraLineIds = e.pin?.lineId === d.after.statementLineId ? e.pin.extraLineIds : [];
          e.pin = { lineId: d.after.statementLineId, extraLineIds, seq };
        }
        break;
      }
      case "sign_off_difference":
        effectsOf(d.subjectId).signOff = { lineId: d.after.statementLineId, stamp };
        break;
      case "resolve_duplicate":
        effectsOf(d.subjectId).duplicate = { duplicate: d.after.duplicate, stamp };
        break;
      case "request_reupload":
        effectsOf(d.subjectId).removed = stamp;
        break;
      case "link_receipt":
        // R-MAT-7 from the line's side: the same as choosing this line for the receipt.
        effectsOf(d.after.receiptId).pin = { lineId: d.subjectId, extraLineIds: [], seq };
        effectsOf(d.after.receiptId).decisions.push(d);
        lines.set(d.subjectId, null);
        break;
      case "record_substitute":
        lines.set(d.subjectId, { kind: "substitute", category: d.after.category, stamp });
        break;
      case "mark_not_expense":
        lines.set(d.subjectId, { kind: "not_expense", stamp });
        break;
    }
    const onLine = ["link_receipt", "record_substitute", "mark_not_expense"].includes(d.action);
    if (!onLine) effectsOf(d.subjectId).decisions.push(d);
  });

  // R-MAT-4: one line, one receipt. If two people's choices claim a line, the later one wins
  // and the earlier receipt goes back to automatic matching.
  // Every line of a split counts, and losing any one of them undoes the whole split.
  const pinned = (e: ReceiptEffects) =>
    e.pin?.lineId ? [e.pin.lineId, ...e.pin.extraLineIds] : [];
  const owner = new Map<string, { receiptId: string; seq: number }>();
  for (const [id, e] of receipts) {
    for (const lineId of pinned(e)) {
      const current = owner.get(lineId);
      const seq = e.pin?.seq ?? -1;
      if (!current || current.seq < seq) owner.set(lineId, { receiptId: id, seq });
    }
  }
  for (const [id, e] of receipts) {
    if (pinned(e).some((lineId) => owner.get(lineId)?.receiptId !== id)) e.pin = null;
  }
  return { receipts, lines };
}

const EMPTY_EXTRACTION: Extraction = {
  isReceipt: true,
  vendor: { value: null, confidence: 0 },
  date: { value: null, confidence: 0 },
  total: { value: null, confidence: 0 },
  currency: { value: null, confidence: 0 },
  tax: { value: null, confidence: 0 },
  summary: { value: null, confidence: 0 },
};

/** A corrected field is the person's value with full confidence (04, approval point 4). */
function correctedExtraction(
  read: Extraction | null,
  fields: ReadonlyMap<CorrectableField, Correction>,
): Extraction | null {
  const changed = EXTRACTION_FIELDS.filter((f) => fields.has(f));
  if (changed.length === 0) return read;
  const next: Extraction = structuredClone(read ?? EMPTY_EXTRACTION);
  for (const name of changed) {
    const value = fields.get(name)?.value ?? null;
    if (name === "total" || name === "tax") {
      next[name] = { value: value === null ? null : Number(value), confidence: 1 };
    } else {
      next[name] = { value, confidence: 1 };
    }
  }
  return next;
}

function effectiveCategory(
  read: CategoryResult | null,
  fields: ReadonlyMap<CorrectableField, Correction>,
  extraction: Extraction,
  config: PipelineConfig,
): CategoryResult {
  const chosen = fields.get("category");
  if (chosen) {
    return {
      category: chosen.value,
      source: "human",
      confidence: 1,
      reason: `chosen by ${chosen.stamp.by}`,
      exceptions: chosen.value ? [] : ["UNKNOWN_CATEGORY"],
    };
  }
  // A corrected vendor or item list, or details entered by hand, get the rule table again.
  if (read === null || fields.has("vendor") || fields.has("summary")) {
    const rule = categoriseByRules(
      extraction.vendor.value,
      extraction.summary.value,
      config.categories.rules,
    );
    if (rule) return rule;
  }
  return (
    read ?? {
      category: null,
      source: "rule",
      confidence: 0,
      reason: "No vendor rule matches; choose a category.",
      exceptions: ["UNKNOWN_CATEGORY"],
    }
  );
}

interface Derived {
  read: ReadReceipt;
  effects: ReceiptEffects | undefined;
  paymentSource: PaymentSource;
  purpose: string | null;
  extraction: Extraction | null;
  enteredByHand: boolean;
  exceptions: ExceptionCode[];
  notes: string[];
  lowConfidenceFields: string[];
  currency: string | null;
  category: CategoryResult | null;
  readable: boolean;
  conversion: Conversion | null;
}

/** Per receipt: corrections applied, then the intake, quality, extraction, and category rules. */
function deriveReading(
  read: ReadReceipt,
  effects: ReceiptEffects | undefined,
  snapshot: MonthSnapshot,
  config: PipelineConfig,
): Derived {
  const fields = effects?.fields ?? new Map<CorrectableField, Correction>();
  const source = PaymentSource.safeParse(fields.get("paymentSource")?.value);
  const purposeFix = fields.get("businessPurpose");
  const purpose = (purposeFix ? purposeFix.value : read.intake.businessPurpose)?.trim() || null;
  const extraction = correctedExtraction(read.extraction, fields);
  const failed = !read.gate.ok || read.extractFailure !== null;
  const enteredByHand =
    failed && extraction !== null && REQUIRED_BY_HAND.every((f) => extraction[f].value !== null);

  const d: Derived = {
    read,
    effects,
    paymentSource: source.success ? source.data : read.intake.paymentSource,
    purpose,
    extraction,
    enteredByHand,
    exceptions: [...checkBusinessPurpose(purpose)], // R-REQ-1
    notes: [],
    lowConfidenceFields: [],
    currency: null,
    category: null,
    readable: false,
    conversion: null,
  };

  if (failed && !enteredByHand) {
    d.exceptions.push("UNREADABLE");
    d.notes.push(read.gate.ok ? (read.extractFailure ?? "") : read.gate.reason);
    return d;
  }
  if (!extraction) return d;
  if (enteredByHand) d.notes.push("Details entered by hand.");

  d.lowConfidenceFields = lowConfidenceFields(extraction, config.extractConfidenceMin);
  if (d.lowConfidenceFields.length > 0) d.exceptions.push("LOW_CONFIDENCE_FIELD");
  const notReceipt = checkIsReceipt(extraction.isReceipt); // R-QUA-4
  d.exceptions.push(...notReceipt);
  if (notReceipt.length > 0) return d;

  const currency = checkCurrency(extraction.currency, config.extractConfidenceMin); // R-CUR-5
  d.currency = currency.currency;
  d.exceptions.push(...currency.exceptions);
  d.readable = true;
  d.category = effectiveCategory(read.category, fields, extraction, config);
  d.exceptions.push(...d.category.exceptions);

  const total = extraction.total.value;
  const date = extraction.date.value;
  if (total !== null && d.currency && date) {
    d.conversion = convertToAud(total, d.currency, date, snapshot.rates);
    if (d.conversion.status === "unavailable") d.exceptions.push(d.conversion.exception);
  }
  return d;
}

function toMatchReceipt(d: Derived): MatchReceipt {
  const c = d.conversion;
  return {
    id: d.read.intake.id,
    total: d.extraction?.total.value ?? null,
    currency: d.currency,
    totalAud: c && c.status !== "unavailable" ? c.amountAud : null,
    date: d.extraction?.date.value ?? null,
    vendor: d.extraction?.vendor.value ?? null,
    paymentSource: d.paymentSource,
  };
}

const REIMBURSE: Omit<MatchOutcome, "receiptId"> = {
  status: "unmatched",
  statementLineId: null,
  candidates: [],
  exceptions: [],
  reimbursement: true,
};

/** The month's derived state for a given list of decisions (the core of `reconcileMonth`). */
function derive(snapshot: MonthSnapshot, decisions: readonly Decision[], config: PipelineConfig) {
  const folded = foldDecisions(decisions);
  const derived = snapshot.receipts.map((r) =>
    deriveReading(r, folded.receipts.get(r.intake.id), snapshot, config),
  );

  // Duplicates (R-DUP-1/2) over every upload still in the month, so a re-uploaded unreadable
  // file is still caught. A person's "not a duplicate" decision clears the flag.
  const inMonth = derived.filter((d) => !d.effects?.removed);
  const flags = findDuplicates(
    inMonth.map((d) => ({
      id: d.read.intake.id,
      uploadOrder: d.read.intake.uploadOrder,
      fileHash: d.read.intake.file.sha256,
      vendor: d.extraction?.vendor.value ?? null,
      date: d.extraction?.date.value ?? null,
      total: d.extraction?.total.value ?? null,
      currency: d.currency,
    })),
  );
  const isDuplicate = (d: Derived) =>
    flags.has(d.read.intake.id) && d.effects?.duplicate?.duplicate !== false;

  // Matching (R-MAT): lines resolved as "no receipt" are out of the pool; a person's chosen
  // line is assigned first; everything else is matched automatically over what is left.
  const resolvedLines = new Set(
    [...folded.lines].flatMap(([id, resolution]) => (resolution ? [id] : [])),
  );
  const lineById = new Map(snapshot.statementLines.map((l) => [l.id, l]));
  const matchable = derived.filter((d) => d.readable && !isDuplicate(d) && !d.effects?.removed);
  const outcomes = new Map<string, MatchOutcome>();
  const taken = new Set<string>();
  for (const d of matchable) {
    const pin = d.effects?.pin;
    if (!pin) continue;
    if (pin.lineId === null) {
      outcomes.set(d.read.intake.id, { receiptId: d.read.intake.id, ...REIMBURSE });
      continue;
    }
    // One line, or every line of a split (R-MAT-10); all must still be on the statement and free.
    const lines = [pin.lineId, ...pin.extraLineIds].flatMap((id) => {
      const l = lineById.get(id);
      return l && !resolvedLines.has(l.id) ? [l] : [];
    });
    if (lines.length === 1 + pin.extraLineIds.length) {
      outcomes.set(
        d.read.intake.id,
        applyChosenLines(toMatchReceipt(d), lines, config.matchPolicy),
      );
      for (const l of lines) taken.add(l.id);
    }
  }
  const auto = matchReceipts(
    matchable.filter((d) => !outcomes.has(d.read.intake.id)).map(toMatchReceipt),
    snapshot.statementLines.filter((l) => !taken.has(l.id) && !resolvedLines.has(l.id)),
    snapshot.monthKey,
    config.matchPolicy,
  );
  for (const o of auto) outcomes.set(o.receiptId, o);

  const receipts: ReceiptResult[] = derived.map((d) => {
    const id = d.read.intake.id;
    const e = d.effects;
    const match = outcomes.get(id) ?? null;
    const line = match?.statementLineId ? lineById.get(match.statementLineId) : undefined;
    const chosen: Candidate | undefined = match?.candidates.find(
      (c) => c.statementLineId === match.statementLineId,
    );
    const duplicate = isDuplicate(d);
    const removed = e?.removed ?? null;
    // R-CUR-3 applies only when a rate is needed. A receipt paid from a line whose amount was
    // compared in its own currency takes the bank's AUD charge (R-CUR-4), so a missing rate
    // changes nothing (Day 4, F4). If the amount could not be compared, the flag stays.
    const rateNotNeeded =
      line !== undefined && chosen?.amount != null && chosen.amount.comparedIn !== BASE_CURRENCY;
    const state = deriveReceiptState({
      exceptions: [
        ...(rateNotNeeded ? d.exceptions.filter((c) => c !== "FX_RATE_UNAVAILABLE") : d.exceptions),
        ...(match?.exceptions ?? []),
        ...(duplicate ? ["DUPLICATE" as const] : []),
      ],
      match,
      // The AUD charged: the line's, or every split line's added up (R-MAT-10).
      matchedLineAmountAud: line
        ? fromCents(
            [line.id, ...(match?.extraLineIds ?? [])].reduce(
              (sum, lineId) => sum + toCents(lineById.get(lineId)?.amountAud ?? 0),
              0,
            ),
          )
        : null,
      receiptAmountAud:
        d.conversion && d.conversion.status !== "unavailable" ? d.conversion.amountAud : null,
      // A removed receipt is out of the totals the same way an unconfirmed duplicate is.
      duplicate: duplicate || removed !== null,
    });

    // R-AMT-4: a sign-off holds only for the line it was given against.
    const signOff =
      e?.signOff && state.status === "amount_differs" && e.signOff.lineId === match?.statementLineId
        ? e.signOff.stamp
        : null;
    const outcome: ReceiptOutcome = removed
      ? "removed"
      : duplicate && e?.duplicate?.duplicate === true
        ? "duplicate_confirmed"
        : e?.approval
          ? "approved"
          : "open";

    return {
      id,
      submitterId: d.read.intake.submitterId,
      paymentSource: d.paymentSource,
      paymentSourceLabel: paymentSourceLabel(d.paymentSource),
      businessPurpose: d.purpose,
      filePath: d.read.intake.file.path,
      extraction: d.extraction,
      lowConfidenceFields: d.lowConfidenceFields,
      notes: d.notes,
      conversion: d.conversion,
      category: d.category,
      duplicateOf: flags.get(id)?.duplicateOf ?? null,
      match,
      difference:
        chosen?.amount?.kind === "small"
          ? { amount: chosen.amount.difference, currency: chosen.amount.comparedIn }
          : null,
      state,
      openExceptions:
        outcome === "open"
          ? state.exceptions.filter((c) => !(c === "AMOUNT_DIFFERS_OVER_THRESHOLD" && signOff))
          : [],
      outcome,
      corrected: [...(e?.fields.keys() ?? [])],
      enteredByHand: d.enteredByHand,
      matchInput: d.readable ? toMatchReceipt(d) : null,
      concerns:
        line && chosen
          ? pairingConcerns(
              toMatchReceipt(d),
              combinedPayment(
                [line.id, ...(match?.extraLineIds ?? [])].flatMap((id) => lineById.get(id) ?? []),
              ),
              chosen,
            )
          : [],
      signOff,
      approval: e?.approval ?? null,
    };
  });

  const matchedLineIds = receipts.flatMap((r) =>
    r.match?.statementLineId && r.outcome !== "removed"
      ? [r.match.statementLineId, ...(r.match.extraLineIds ?? [])]
      : [],
  );
  const noReceipt: NoReceiptLine[] = linesWithoutReceipt(
    snapshot.statementLines,
    matchedLineIds,
  ).map((line) => ({
    line,
    resolution: folded.lines.get(line.id) ?? null,
    candidateFor: receipts
      .filter(
        (r) =>
          r.outcome === "open" &&
          r.match?.statementLineId == null &&
          r.match?.candidates.some(
            (c) => c.statementLineId === line.id && c.score >= MIN_CANDIDATE_SCORE,
          ),
      )
      .map((r) => r.id),
  }));
  return { receipts, noReceipt };
}

const RECEIPT_AMOUNT = (r: ReceiptResult): number | null =>
  r.state.ledgerAmountAud ??
  (r.conversion && r.conversion.status !== "unavailable" ? r.conversion.amountAud : null);

/** Plain-language resolution for an exception that is no longer open. */
function resolutionOf(
  code: ExceptionCode,
  r: ReceiptResult,
): { text: string; stamp: Stamp | null } {
  if (r.outcome === "removed") return { text: "removed from the month for re-upload", stamp: null };
  if (code === "DUPLICATE") {
    return r.outcome === "duplicate_confirmed"
      ? { text: "confirmed duplicate: kept on record, left out of totals", stamp: null }
      : { text: "marked not a duplicate", stamp: null };
  }
  if (code === "AMOUNT_DIFFERS_OVER_THRESHOLD" && r.signOff) {
    return { text: "difference signed off", stamp: r.signOff };
  }
  if (code === "MISSING_PURPOSE" && r.corrected.includes("businessPurpose")) {
    return { text: "purpose added", stamp: null };
  }
  if (code === "UNKNOWN_CATEGORY" && r.corrected.includes("category")) {
    return { text: "category chosen", stamp: null };
  }
  if (code === "UNREADABLE" && r.enteredByHand)
    return { text: "details entered by hand", stamp: null };
  if (code === "LOW_CONFIDENCE_FIELD" && r.corrected.some((f) => f !== "category")) {
    return { text: "fields checked by a person", stamp: null };
  }
  if (code === "AMBIGUOUS_MATCH" || code === "NO_PAYMENT_FOUND") {
    if (r.match?.reimbursement)
      return { text: "to be reimbursed (no statement line)", stamp: null };
    if (r.match?.statementLineId) {
      return { text: `matched to ${r.match.statementLineId} by a person`, stamp: null };
    }
  }
  if (r.outcome === "approved") return { text: "approved as shown", stamp: r.approval };
  return { text: "cleared after other changes", stamp: null };
}

function exceptionLog(
  base: { receipts: ReceiptResult[]; noReceipt: NoReceiptLine[] },
  now: { receipts: ReceiptResult[]; noReceipt: NoReceiptLine[] },
): ExceptionLogRow[] {
  const rows: ExceptionLogRow[] = [];
  const baseById = new Map(base.receipts.map((r) => [r.id, r]));
  for (const r of now.receipts) {
    const raised = new Set([
      ...(baseById.get(r.id)?.state.exceptions ?? []),
      ...r.state.exceptions,
    ]);
    for (const code of raised) {
      const open = r.openExceptions.includes(code);
      const resolved = open ? null : resolutionOf(code, r);
      rows.push({
        itemId: r.id,
        itemKind: "receipt",
        code,
        open,
        resolution: open ? "open" : (resolved?.text ?? ""),
        stamp: resolved?.stamp ?? null,
      });
    }
  }
  for (const { line, resolution } of now.noReceipt) {
    rows.push({
      itemId: line.id,
      itemKind: "statement_line",
      code: "NO_RECEIPT",
      open: resolution === null,
      resolution:
        resolution === null
          ? "open"
          : resolution.kind === "substitute"
            ? `substitute recorded (${resolution.category})`
            : "not an expense",
      stamp: resolution?.stamp ?? null,
    });
  }
  // Lines that were "no receipt" before decisions and are now matched to a receipt.
  const stillListed = new Set(now.noReceipt.map((n) => n.line.id));
  for (const { line } of base.noReceipt) {
    if (stillListed.has(line.id)) continue;
    const receipt = now.receipts.find((r) => r.match?.statementLineId === line.id);
    rows.push({
      itemId: line.id,
      itemKind: "statement_line",
      code: "NO_RECEIPT",
      open: false,
      resolution: receipt ? `matched to receipt ${receipt.id}` : "matched",
      stamp: null,
    });
  }
  return rows;
}

/** The month with no decisions, per snapshot: what each exception-log row started from. */
const baseCache = new WeakMap<
  MonthSnapshot,
  { config: PipelineConfig; result: ReturnType<typeof derive> }
>();

/**
 * The month as it stands after `decisions` (in the order they were made). With no decisions
 * this is exactly what the pipeline found, which is what `pnpm eval` scores.
 */
export function reconcileMonth(
  snapshot: MonthSnapshot,
  decisions: readonly Decision[],
  config: PipelineConfig,
): MonthResult {
  const now = derive(snapshot, decisions, config);
  let base = baseCache.get(snapshot);
  if (!base || base.config !== config) {
    base = { config, result: decisions.length === 0 ? now : derive(snapshot, [], config) };
    baseCache.set(snapshot, base);
  }

  const openReceipts = now.receipts.filter((r) => r.outcome === "open");
  const queueItems: QueueItem[] = [
    ...openReceipts.map(
      (r): QueueItem => ({
        kind: "receipt",
        id: r.id,
        status: r.state.status,
        exceptions: r.openExceptions,
        reimbursement: r.state.reimbursement,
        amountAud: RECEIPT_AMOUNT(r),
      }),
    ),
    ...now.noReceipt
      .filter((n) => n.resolution === null)
      .map(
        (n): QueueItem => ({ kind: "no_receipt_line", id: n.line.id, amountAud: n.line.amountAud }),
      ),
  ];
  const done: QueueItem[] = [
    ...now.receipts
      .filter((r) => r.outcome !== "open")
      .map(
        (r): QueueItem => ({
          kind: "receipt",
          id: r.id,
          status: r.state.status,
          exceptions: r.state.exceptions,
          reimbursement: r.state.reimbursement,
          amountAud: RECEIPT_AMOUNT(r),
        }),
      ),
    ...now.noReceipt
      .filter((n) => n.resolution !== null)
      .map(
        (n): QueueItem => ({ kind: "no_receipt_line", id: n.line.id, amountAud: n.line.amountAud }),
      ),
  ];

  const sum = (amounts: number[]) => fromCents(amounts.reduce((s, a) => s + toCents(a), 0));
  const included = now.receipts.filter((r) => !r.state.excludedFromTotals);
  const substitutes = now.noReceipt.flatMap((n) =>
    n.resolution?.kind === "substitute" ? [n.line.amountAud] : [],
  );

  return {
    runId: snapshot.runId,
    monthKey: snapshot.monthKey,
    mode: snapshot.mode,
    startedAt: snapshot.startedAt,
    finishedAt: snapshot.finishedAt,
    statementFormat: snapshot.statementFormat,
    receipts: now.receipts,
    noReceipt: now.noReceipt,
    noReceiptLines: now.noReceipt.map((n) => n.line),
    freeLines: now.noReceipt
      .filter((n) => n.resolution === null && !isCredit(n.line)) // R-MAT-8
      .map((n) => n.line),
    statementLines: snapshot.statementLines,
    queue: orderQueue(queueItems),
    done,
    closed: queueItems.length === 0,
    exceptionLog: exceptionLog(base.result, now),
    totals: {
      ledgerAud: sum([...included.map((r) => r.state.ledgerAmountAud ?? 0), ...substitutes]),
      approvedAud: sum([
        ...included
          .filter((r) => r.outcome === "approved")
          .map((r) => r.state.ledgerAmountAud ?? 0),
        ...substitutes,
      ]),
      // Only amounts actually left out: a foreign receipt paid at the bank's AUD charge is in
      // the ledger even with no rate, so listing it here contradicted the total (Day 4, F4).
      excludedFx: summariseExcluded(
        now.receipts.flatMap((r) =>
          r.conversion &&
          r.outcome !== "removed" &&
          r.state.exceptions.includes("FX_RATE_UNAVAILABLE")
            ? [r.conversion]
            : [],
        ),
      ),
    },
    log: [],
    decisionCount: decisions.length,
  };
}
