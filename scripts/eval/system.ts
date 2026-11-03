import { checkApproval, isBulkApprovable } from "@/core/approvals";
import { applyChosenLine, type MatchPolicy } from "@/core/matching";
import type { ExceptionCode, StatementLine } from "@/core/schemas";
import type { MonthResult, ReceiptResult } from "@/pipeline/run-month";
import type { GroundTruthReceipt, TestCaseId } from "../dataset/schema";
import { type Prediction, type Ratio, type RunScore, scoreRun } from "./score";

// System-side scoring for `pnpm eval`, using the definitions in docs/sprint/06-evaluation-plan.md.
// Field and exception metrics reuse the baseline scorer (scripts/eval/score.ts), so B0, B1, and
// the system are scored the same way.

const ratio = (hit: number, of: number): Ratio => ({ hit, of, rate: of === 0 ? null : hit / of });
const REVIEWER = "eval-reviewer"; // never a submitter, so R-APR-1 does not interfere

/**
 * The human's expected match decision, simulated: an ambiguous receipt whose true line is
 * among its candidates gets that line chosen (R-MAT-5). Returns the exceptions after the choice
 * (TC04: AMBIGUOUS_MATCH resolves, AMOUNT_DIFFERS_OVER_THRESHOLD fires).
 */
export function afterExpectedChoice(
  r: ReceiptResult,
  truth: GroundTruthReceipt,
  lines: ReadonlyMap<string, StatementLine>,
  policy: MatchPolicy,
): { exceptions: ExceptionCode[]; lineId: string | null } {
  const offered = r.match?.candidates.some((c) => c.statementLineId === truth.statementLineId);
  const line = truth.statementLineId ? lines.get(truth.statementLineId) : undefined;
  if (r.state.status !== "ambiguous" || !offered || !line || !r.extraction) {
    return { exceptions: r.state.exceptions, lineId: r.match?.statementLineId ?? null };
  }
  const chosen = applyChosenLine(
    {
      id: r.id,
      total: r.extraction.total.value,
      currency: r.extraction.currency.value,
      totalAud:
        r.conversion && r.conversion.status !== "unavailable" ? r.conversion.amountAud : null,
      date: r.extraction.date.value,
      vendor: r.extraction.vendor.value,
      paymentSource: r.paymentSource as "company_card",
    },
    line,
    policy,
  );
  const rest = r.state.exceptions.filter((c) => c !== "AMBIGUOUS_MATCH");
  return { exceptions: [...rest, ...chosen.exceptions], lineId: line.id };
}

export interface CaseCheck {
  receiptId: string;
  testCase: TestCaseId;
  failures: string[];
}

export interface TestCaseResult {
  testCase: TestCaseId;
  receipts: string[];
  pass: boolean;
  failures: string[];
}

/** 06 test-case table, one assertion list per TC. A TC passes only if every assertion holds. */
function checkReceipt(
  tc: TestCaseId,
  r: ReceiptResult,
  t: GroundTruthReceipt,
  after: { exceptions: ExceptionCode[]; lineId: string | null },
): string[] {
  const fails: string[] = [];
  const need = (ok: boolean, what: string) => {
    if (!ok) fails.push(what);
  };
  const e = r.extraction;
  const fieldsRight =
    e !== null &&
    e.total.value !== null &&
    Math.abs(e.total.value - t.fields.total) <= 0.01 &&
    e.currency.value === t.fields.currency &&
    e.date.value === t.fields.date;
  const autoLine = r.state.status === "matched" ? (r.match?.statementLineId ?? null) : null;
  const candidates = r.match?.candidates.map((c) => c.statementLineId) ?? [];
  const has = (code: ExceptionCode) => r.state.exceptions.includes(code);

  switch (tc) {
    case "TC01":
      need(
        autoLine === t.statementLineId,
        `auto-matched to ${t.statementLineId} (got ${autoLine})`,
      );
      need(
        r.category?.category === t.category,
        `category ${t.category} (got ${r.category?.category})`,
      );
      need(isBulkApprovable(r.state), "in the bulk-approve group");
      break;
    case "TC02":
      need(autoLine === t.statementLineId, `matched to ${t.statementLineId} (got ${autoLine})`);
      need(r.conversion?.status === "converted", "converted with a stored rate (R-CUR-2)");
      need(!has("AMOUNT_DIFFERS_OVER_THRESHOLD"), "no amount-difference flag (R-CUR-4)");
      need(
        r.state.ledgerAmountAud === t.ledgerAmountAud,
        `ledger ${t.ledgerAmountAud} AUD (got ${r.state.ledgerAmountAud})`,
      );
      break;
    case "TC03":
      need(e?.currency.value === "AUD", `currency AUD (got ${e?.currency.value})`);
      need(r.conversion?.status === "base", "never entered FX conversion (R-CUR-1)");
      need(!r.state.excludedFromTotals, "included in totals");
      break;
    case "TC04":
      need(r.state.status === "ambiguous", `ambiguous before a decision (got ${r.state.status})`);
      need(has("AMBIGUOUS_MATCH"), "AMBIGUOUS_MATCH before a decision");
      need(
        candidates.includes(t.statementLineId ?? ""),
        `${t.statementLineId} offered as a candidate`,
      );
      need(
        after.exceptions.includes("AMOUNT_DIFFERS_OVER_THRESHOLD"),
        "AMOUNT_DIFFERS_OVER_THRESHOLD once the line is chosen",
      );
      need(
        !checkApproval(
          { submitterId: r.submitterId, status: "amount_differs", exceptions: after.exceptions },
          REVIEWER,
        ).allowed,
        "approval needs a reason after the choice (R-AMT-4)",
      );
      break;
    case "TC05":
      need(autoLine === t.statementLineId, `matched to ${t.statementLineId} (got ${autoLine})`);
      need(
        r.difference?.amount === t.amountDifferenceAud,
        `badge +${t.amountDifferenceAud} (got ${r.difference?.amount ?? "none"})`,
      );
      need(isBulkApprovable(r.state), "bulk-approvable, no reason needed");
      break;
    case "TC06":
      need(has("MISSING_PURPOSE"), "MISSING_PURPOSE");
      need(
        !checkApproval({ ...r.state, submitterId: r.submitterId }, REVIEWER).allowed,
        "approval blocked",
      );
      break;
    case "TC07":
      if (t.duplicateOf === null) {
        // The original upload: never flagged, stays in the totals.
        need(!has("DUPLICATE"), "the original is not flagged");
        need(!r.state.excludedFromTotals, "the original stays in the totals");
        break;
      }
      need(has("DUPLICATE"), "DUPLICATE");
      need(r.duplicateOf === t.duplicateOf, `duplicate of ${t.duplicateOf} (got ${r.duplicateOf})`);
      need(r.state.excludedFromTotals, "excluded from totals");
      break;
    case "TC08":
    case "TC09":
      need(!has("UNREADABLE"), "passes the quality gate");
      need(fieldsRight, "total, currency, and date extracted correctly");
      break;
    case "TC10":
      need(r.state.status === "unmatched", `unmatched (got ${r.state.status})`);
      need(r.state.reimbursement, "offered as a reimbursement");
      need(!has("NO_PAYMENT_FOUND"), "not flagged as an error");
      break;
    case "TC11":
      need(r.state.status === "ambiguous", `ambiguous, never auto-picked (got ${r.state.status})`);
      need(candidates.includes("L22") && candidates.includes("L24"), "both twin lines ranked");
      break;
    case "TC12":
      need(
        r.category?.category === t.category,
        `category ${t.category} (got ${r.category?.category ?? "none"})`,
      );
      need(r.category?.category !== "Other", "never Other");
      break;
  }
  return fails;
}

export interface SystemScore {
  base: RunScore; // extraction, category, exception recall/precision (shared definitions)
  wrongAutoMatchRate: Ratio;
  matchRecallTop1: Ratio;
  humanTouches: Ratio;
  noReceiptLineRecall: Ratio | null; // full set only
  testCases: TestCaseResult[];
  checks: CaseCheck[];
}

export function scoreSystem(
  result: MonthResult,
  truth: GroundTruthReceipt[],
  allTruth: { statementLines: { id: string; receiptId: string | null }[] },
  lines: readonly StatementLine[],
  policy: MatchPolicy,
  fullSet: boolean,
): SystemScore {
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const byId = new Map(result.receipts.map((r) => [r.id, r]));
  const evaluated = truth.filter((t) => byId.has(t.id));

  const predictions: Prediction[] = [];
  const checks: CaseCheck[] = [];
  const chosenLines = new Set<string>();
  let autoMatched = 0;
  let autoWrong = 0;
  let top1Right = 0;
  let touches = 0;

  for (const t of evaluated) {
    const r = byId.get(t.id);
    if (!r) continue;
    const after = afterExpectedChoice(r, t, lineById, policy);
    if (after.lineId) chosenLines.add(after.lineId);
    const autoLine = r.state.status === "matched" ? (r.match?.statementLineId ?? null) : null;
    if (autoLine) {
      autoMatched += 1;
      if (autoLine !== t.statementLineId) autoWrong += 1;
    }
    const top1 = autoLine ?? r.match?.candidates[0]?.statementLineId ?? null;
    if (t.statementLineId && top1 === t.statementLineId) top1Right += 1;
    if (!isBulkApprovable(r.state)) touches += 1;

    predictions.push({
      receiptId: t.id,
      vendor: r.extraction?.vendor.value,
      date: r.extraction?.date.value,
      total: r.extraction?.total.value,
      currency: r.extraction?.currency.value,
      category: r.category?.category,
      statementLineId: autoLine, // wrongMatchRate in the shared scorer = wrong auto-matches
      exceptions: after.exceptions,
    });
    for (const tc of t.testCases) {
      checks.push({ receiptId: t.id, testCase: tc, failures: checkReceipt(tc, r, t, after) });
    }
  }

  const tcs = [...new Set(checks.map((c) => c.testCase))].sort();
  const testCases = tcs.map((tc) => {
    const forTc = checks.filter((c) => c.testCase === tc);
    const failures = forTc.flatMap((c) => c.failures.map((f) => `${c.receiptId}: ${f}`));
    return {
      testCase: tc,
      receipts: forTc.map((c) => c.receiptId),
      pass: failures.length === 0,
      failures,
    };
  });

  let noReceiptLineRecall: Ratio | null = null;
  if (fullSet) {
    const expected = allTruth.statementLines.filter((l) => l.receiptId === null).map((l) => l.id);
    const listed = new Set(lines.filter((l) => !chosenLines.has(l.id)).map((l) => l.id));
    noReceiptLineRecall = ratio(expected.filter((id) => listed.has(id)).length, expected.length);
  }

  return {
    base: scoreRun(evaluated, predictions),
    wrongAutoMatchRate: ratio(autoWrong, autoMatched),
    matchRecallTop1: ratio(top1Right, evaluated.filter((t) => t.statementLineId !== null).length),
    humanTouches: ratio(touches, evaluated.length),
    noReceiptLineRecall,
    testCases,
    checks,
  };
}
