import { paymentStatus } from "./matching";
import { ExceptionCode, type MatchStatus } from "./schemas";

// Exception and status derivation (04: "exception rules", "status derivation").
// Statuses are derived from stage results, never hand-picked (CLAUDE.md non-negotiable 3).

export interface ReceiptFindings {
  /** Exceptions raised by each stage, in any order and possibly repeated. */
  exceptions: readonly ExceptionCode[];
  /** Null when the receipt never reached matching (duplicate, unreadable, not a receipt). */
  match: { status: MatchStatus; statementLineId: string | null; reimbursement: boolean } | null;
  /** The matched line's AUD charge: the ledger amount (R-CUR-4). */
  matchedLineAmountAud: number | null;
  /** The receipt total in AUD (R-CUR-1/2), or null when unknown or FX is unavailable. */
  receiptAmountAud: number | null;
  duplicate: boolean;
}

export interface ReceiptState {
  exceptions: ExceptionCode[];
  status: MatchStatus;
  paymentStatus: "paid" | "unpaid";
  reimbursement: boolean;
  /** The amount this receipt adds to the ledger, or null while it is out of the totals. */
  ledgerAmountAud: number | null;
  excludedFromTotals: boolean;
}

const ORDER = ExceptionCode.options;

/** One copy of each exception, in the canonical order of the schema. */
export function normaliseExceptions(codes: readonly ExceptionCode[]): ExceptionCode[] {
  const set = new Set(codes);
  return ORDER.filter((code) => set.has(code));
}

/**
 * Derives the receipt's state:
 * - status comes only from matching (R-MAT-5); a receipt that never reached matching is unmatched.
 * - ledger amount: the matched line's AUD charge (R-CUR-4); for a reimbursement, the receipt's
 *   AUD total; otherwise none until a person resolves the item.
 * - excluded from totals: duplicates until a person decides (R-DUP-1), and anything without a
 *   ledger amount, such as a foreign receipt with no FX rate (R-CUR-3).
 */
export function deriveReceiptState(findings: ReceiptFindings): ReceiptState {
  const status = findings.match?.status ?? "unmatched";
  const lineId = findings.match?.statementLineId ?? null;
  const paid = paymentStatus(status, lineId);
  const reimbursement = !findings.duplicate && (findings.match?.reimbursement ?? false);

  let ledgerAmountAud: number | null = null;
  if (!findings.duplicate) {
    if (paid === "paid") ledgerAmountAud = findings.matchedLineAmountAud;
    else if (reimbursement) ledgerAmountAud = findings.receiptAmountAud;
  }

  return {
    exceptions: normaliseExceptions(findings.exceptions),
    status,
    paymentStatus: paid,
    reimbursement,
    ledgerAmountAud,
    excludedFromTotals: findings.duplicate || ledgerAmountAud === null,
  };
}
