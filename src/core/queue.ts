import { fromCents, toCents } from "./money";
import type { ExceptionCode, MatchStatus } from "./schemas";

// Review queue order R-QUE (docs/sprint/05-business-rules.md): the user's explicit request
// (evidence E6), extended for the new exception types.

export type QueueItem =
  | {
      kind: "receipt";
      id: string;
      status: MatchStatus;
      exceptions: readonly ExceptionCode[];
      reimbursement: boolean;
      amountAud: number | null;
    }
  | { kind: "no_receipt_line"; id: string; amountAud: number }; // R-MAT-7

export const QUEUE_GROUPS = [
  { group: 1, title: "Blocking intake problems" },
  { group: 2, title: "Amount differences" },
  { group: 3, title: "Missing information" },
  { group: 4, title: "Approvals needing a match decision" },
  { group: 5, title: "Matches ready to approve" },
] as const;
export type QueueGroupNumber = (typeof QUEUE_GROUPS)[number]["group"];

const INTAKE: readonly ExceptionCode[] = ["UNREADABLE", "NOT_A_RECEIPT", "DUPLICATE"];
const MISSING_INFO: readonly ExceptionCode[] = [
  "MISSING_PURPOSE",
  "LOW_CONFIDENCE_FIELD",
  "UNKNOWN_CATEGORY",
  "FX_RATE_UNAVAILABLE",
];
const MATCH_DECISION: readonly ExceptionCode[] = ["AMBIGUOUS_MATCH", "NO_PAYMENT_FOUND"];

/**
 * R-QUE: an item belongs to the first group whose condition it meets. `exceptions` are the
 * item's open ones: an amount difference that has been signed off (R-AMT-4) is no longer open,
 * so the item moves on to group 5 to be approved, one at a time (R-APR-3 keeps it out of bulk).
 */
export function queueGroup(item: QueueItem): QueueGroupNumber {
  if (item.kind === "no_receipt_line") return 4;
  const has = (codes: readonly ExceptionCode[]) => item.exceptions.some((c) => codes.includes(c));
  if (has(INTAKE)) return 1;
  if (item.exceptions.includes("AMOUNT_DIFFERS_OVER_THRESHOLD")) return 2;
  if (has(MISSING_INFO)) return 3;
  if (has(MATCH_DECISION) || item.reimbursement) return 4;
  if (item.status === "ambiguous" || item.status === "unmatched") return 4;
  return 5;
}

export interface QueueSection {
  group: QueueGroupNumber;
  title: string;
  items: QueueItem[];
  /** R-QUE / E9: every list shows a total for the rows shown. */
  totalAud: number;
}

/**
 * R-QUE: groups in order 1 to 5; within a group, largest AUD amount first (unknown amounts
 * last, then by id so the order is repeatable). Empty groups are kept so the UI can say so.
 */
export function orderQueue(items: readonly QueueItem[]): QueueSection[] {
  return QUEUE_GROUPS.map(({ group, title }) => {
    const inGroup = items
      .filter((item) => queueGroup(item) === group)
      .sort(
        (a, b) =>
          (b.amountAud ?? Number.NEGATIVE_INFINITY) - (a.amountAud ?? Number.NEGATIVE_INFINITY) ||
          a.id.localeCompare(b.id),
      );
    const cents = inGroup.reduce((sum, item) => sum + toCents(item.amountAud ?? 0), 0);
    return { group, title, items: inGroup, totalAud: fromCents(cents) };
  });
}
