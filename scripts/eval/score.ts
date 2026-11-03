import type { ExceptionCode } from "@/core/schemas";
import type { GroundTruthReceipt } from "../dataset/schema";

// Metric definitions from docs/sprint/06-evaluation-plan.md, "Metrics and how each is
// computed". Shared by the baselines (B0, B1) and, later, scripts/eval.ts.

export interface Prediction {
  receiptId: string;
  vendor?: string | null;
  date?: string | null;
  total?: number | null;
  currency?: string | null;
  category?: string | null;
  statementLineId: string | null;
  exceptions: ExceptionCode[];
}

// The codes 03 sets a 100% recall target for.
export const HEADLINE_CODES: ExceptionCode[] = [
  "AMOUNT_DIFFERS_OVER_THRESHOLD",
  "MISSING_PURPOSE",
  "DUPLICATE",
];

// The problem a reviewer must ultimately see. For TC04 the system routes the item as
// AMBIGUOUS_MATCH, but the planted problem is the over-threshold difference.
export function plantedExceptions(truth: GroundTruthReceipt): ExceptionCode[] {
  return truth.exceptionsAfterMatchChoice ?? truth.exceptions;
}

function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = curr;
  }
  return prev[b.length] ?? 0;
}

export function vendorSimilarity(a: string, b: string): number {
  const x = normalise(a);
  const y = normalise(b);
  if (!x && !y) return 1;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

export interface CaseResult {
  receiptId: string;
  totalOk: boolean;
  currencyOk: boolean;
  dateOk: boolean;
  vendorOk: boolean;
  categoryOk: boolean;
  expectedLine: string | null;
  predictedLine: string | null;
  lineOutcome: "correct" | "wrong" | "missed" | "correct_none";
  planted: ExceptionCode[];
  fired: ExceptionCode[];
  missed: ExceptionCode[];
  extra: ExceptionCode[];
}

export interface Ratio {
  hit: number;
  of: number;
  rate: number | null; // null when `of` is 0
}

const ratio = (hit: number, of: number): Ratio => ({
  hit,
  of,
  rate: of === 0 ? null : hit / of,
});

export interface RunScore {
  receipts: number;
  extraction: { total: Ratio; currency: Ratio; date: Ratio; vendor: Ratio };
  category: Ratio;
  matchRecall: Ratio;
  wrongMatchRate: Ratio;
  headlineExceptionRecall: Ratio;
  exceptionRecall: Partial<Record<ExceptionCode, Ratio>>;
  exceptionPrecision: Partial<Record<ExceptionCode, Ratio>>;
  cases: CaseResult[];
}

export function scoreRun(truth: GroundTruthReceipt[], predictions: Prediction[]): RunScore {
  const byId = new Map(predictions.map((p) => [p.receiptId, p]));
  const cases: CaseResult[] = truth.map((t) => {
    const p = byId.get(t.id);
    const planted = plantedExceptions(t);
    const fired = p?.exceptions ?? [];
    const predictedLine = p?.statementLineId ?? null;
    const expectedLine = t.statementLineId;
    let lineOutcome: CaseResult["lineOutcome"];
    if (predictedLine === null) lineOutcome = expectedLine === null ? "correct_none" : "missed";
    else lineOutcome = predictedLine === expectedLine ? "correct" : "wrong";
    return {
      receiptId: t.id,
      totalOk: p?.total != null && Math.abs(p.total - t.fields.total) <= 0.01,
      currencyOk: p?.currency?.toUpperCase() === t.fields.currency,
      dateOk: p?.date === t.fields.date,
      vendorOk: p?.vendor != null && vendorSimilarity(p.vendor, t.fields.vendor) >= 0.8,
      categoryOk: p?.category === t.category,
      expectedLine,
      predictedLine,
      lineOutcome,
      planted,
      fired,
      missed: planted.filter((c) => !fired.includes(c)),
      extra: fired.filter((c) => !planted.includes(c)),
    };
  });

  const count = (pred: (c: CaseResult) => boolean) => cases.filter(pred).length;
  const n = cases.length;
  const codes = [...new Set(cases.flatMap((c) => [...c.planted, ...c.fired]))].sort();
  const exceptionRecall: RunScore["exceptionRecall"] = {};
  const exceptionPrecision: RunScore["exceptionPrecision"] = {};
  for (const code of codes) {
    const planted = count((c) => c.planted.includes(code));
    const fired = count((c) => c.fired.includes(code));
    const both = count((c) => c.planted.includes(code) && c.fired.includes(code));
    if (planted > 0) exceptionRecall[code] = ratio(both, planted);
    if (fired > 0) exceptionPrecision[code] = ratio(both, fired);
  }
  const headlinePlanted = cases.flatMap((c) => c.planted.filter((x) => HEADLINE_CODES.includes(x)));
  const headlineCaught = cases.flatMap((c) =>
    c.planted.filter((x) => HEADLINE_CODES.includes(x) && c.fired.includes(x)),
  );

  return {
    receipts: n,
    extraction: {
      total: ratio(
        count((c) => c.totalOk),
        n,
      ),
      currency: ratio(
        count((c) => c.currencyOk),
        n,
      ),
      date: ratio(
        count((c) => c.dateOk),
        n,
      ),
      vendor: ratio(
        count((c) => c.vendorOk),
        n,
      ),
    },
    category: ratio(
      count((c) => c.categoryOk),
      n,
    ),
    matchRecall: ratio(
      count((c) => c.lineOutcome === "correct"),
      count((c) => c.expectedLine !== null),
    ),
    wrongMatchRate: ratio(
      count((c) => c.lineOutcome === "wrong"),
      count((c) => c.predictedLine !== null),
    ),
    headlineExceptionRecall: ratio(headlineCaught.length, headlinePlanted.length),
    exceptionRecall,
    exceptionPrecision,
    cases,
  };
}
