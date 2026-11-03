import { isValidSignOffReason } from "./amounts";
import type { ExceptionCode, MatchStatus } from "./schemas";

// Approval rules R-APR-1 to R-APR-3 (docs/sprint/05-business-rules.md).

/** R-APR-2: exceptions that block approval until resolved. */
export const BLOCKING_EXCEPTIONS: readonly ExceptionCode[] = [
  "MISSING_PURPOSE",
  "AMOUNT_DIFFERS_OVER_THRESHOLD", // until signed off with a reason (R-AMT-4)
  "DUPLICATE",
  "UNREADABLE",
  "NOT_A_RECEIPT",
  "AMBIGUOUS_MATCH",
  "NO_PAYMENT_FOUND",
];

export interface ApprovalSubject {
  submitterId: string;
  status: MatchStatus;
  exceptions: readonly ExceptionCode[];
  /** R-AMT-4: the reviewer's reason for signing off an over-threshold difference. */
  signOffReason?: string | null;
}

export type ApprovalCheck =
  | { allowed: true }
  | { allowed: false; code: ExceptionCode; reason: string };

const BLOCK_REASONS: Partial<Record<ExceptionCode, string>> = {
  MISSING_PURPOSE: "Add a business purpose first.",
  AMOUNT_DIFFERS_OVER_THRESHOLD: "Give a reason for the amount difference first.",
  DUPLICATE: "Decide whether this is a duplicate first.",
  UNREADABLE: "Re-upload the receipt or enter its details first.",
  NOT_A_RECEIPT: "Replace this file with a receipt first.",
  AMBIGUOUS_MATCH: "Choose the matching payment first.",
  NO_PAYMENT_FOUND: "Choose a payment, or mark it as having no statement line, first.",
};

/**
 * R-APR-1: the submitter cannot approve their own receipt. The UI shows the control disabled
 * with this reason rather than hiding it (UAT: the block worked but looked clickable).
 * R-APR-2: an open blocking exception prevents approval.
 */
export function checkApproval(subject: ApprovalSubject, actorId: string): ApprovalCheck {
  if (subject.submitterId === actorId) {
    return {
      allowed: false,
      code: "SELF_APPROVAL_BLOCKED",
      reason: "You submitted this receipt, so someone else must approve it.",
    };
  }
  for (const code of BLOCKING_EXCEPTIONS) {
    if (!subject.exceptions.includes(code)) continue;
    if (code === "AMOUNT_DIFFERS_OVER_THRESHOLD" && isValidSignOffReason(subject.signOffReason)) {
      continue;
    }
    return { allowed: false, code, reason: BLOCK_REASONS[code] ?? "Resolve the flag first." };
  }
  return { allowed: true };
}

/**
 * R-APR-3: bulk approve covers only `matched` items with no exceptions at all (which also
 * means no low-confidence fields). A small difference badge (R-AMT-3) is not an exception.
 */
export function isBulkApprovable(subject: Pick<ApprovalSubject, "status" | "exceptions">): boolean {
  return subject.status === "matched" && subject.exceptions.length === 0;
}
