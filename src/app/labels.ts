import { personLabel } from "@/config/people";
import { isCredit } from "@/core/matching";
import type { ExceptionCode, MatchStatus } from "@/core/schemas";
import type { NoReceiptLine, ReceiptResult } from "@/pipeline/reconcile";

// Plain-language wording for the Accounting user. One source for the UI and the README.

export const FLAG_LABELS: Record<ExceptionCode, string> = {
  AMOUNT_DIFFERS_OVER_THRESHOLD:
    "Charged amount differs from the receipt by more than policy allows",
  MISSING_PURPOSE: "Business purpose is missing",
  DUPLICATE: "Looks like a duplicate of another receipt",
  NO_PAYMENT_FOUND: "No matching payment on the statement",
  AMBIGUOUS_MATCH: "More than one payment could match: choose one",
  LOW_CONFIDENCE_FIELD: "Some details were hard to read: check them",
  UNREADABLE: "Could not be read",
  NOT_A_RECEIPT: "This file does not look like a receipt",
  SELF_APPROVAL_BLOCKED: "You cannot approve your own receipt",
  FX_RATE_UNAVAILABLE: "No exchange rate available: left out of totals",
  UNKNOWN_CATEGORY: "Category needs choosing",
};

export const STATUS_LABELS: Record<MatchStatus, string> = {
  matched: "Matched",
  unmatched: "No payment",
  amount_differs: "Amount differs",
  ambiguous: "Needs a choice",
};

export const FIELD_LABELS: Record<string, string> = {
  vendor: "vendor",
  date: "date",
  total: "total",
  currency: "currency",
  tax: "GST",
  summary: "items",
};

export function money(amount: number | null | undefined, currency = "AUD"): string {
  if (amount === null || amount === undefined) return "—";
  // A refund is the first negative amount shown: "−$4.50", not "$-4.50".
  const sign = amount < 0 ? "−" : "";
  return `${sign}${currency === "AUD" ? "$" : `${currency} `}${Math.abs(amount).toLocaleString(
    "en-AU",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  )}`;
}

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function list(items: string[]): string {
  return items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** What the person should do next with a receipt, in one or two sentences. */
export function nextStep(r: ReceiptResult): string {
  const open = r.openExceptions;
  const e = r.extraction;
  if (r.outcome === "approved") return `Approved by ${personLabel(r.approval?.by ?? "")}.`;
  if (r.outcome === "duplicate_confirmed")
    return "Confirmed duplicate. Kept on record, left out of totals.";
  if (r.outcome === "removed")
    return "Removed from this month. Ask the submitter to upload it again.";
  if (open.includes("UNREADABLE")) {
    return `${r.notes[0] ?? "Could not be read."} Enter its details by hand, or remove it and ask for a re-upload.`;
  }
  if (open.includes("NOT_A_RECEIPT")) {
    return "This file is not a receipt. Remove it and ask the submitter for the right file.";
  }
  if (open.includes("DUPLICATE")) {
    return `Looks like a copy of ${r.duplicateOf ?? "another receipt"}. Confirm it is a duplicate, or say why it is not.`;
  }
  if (open.includes("AMOUNT_DIFFERS_OVER_THRESHOLD")) {
    const c = r.match?.candidates[0]?.amount;
    const gap = c
      ? ` Charged ${money(c.lineAmount, c.comparedIn)}, receipt says ${money(c.receiptAmount, c.comparedIn)}.`
      : "";
    return `The charge differs from the receipt by more than policy allows.${gap} Sign off with a reason, or choose another payment.`;
  }
  const missing: string[] = [];
  if (open.includes("MISSING_PURPOSE")) missing.push("add what it was for");
  if (open.includes("LOW_CONFIDENCE_FIELD")) {
    missing.push(
      `check the ${list(r.lowConfidenceFields.map((f) => FIELD_LABELS[f] ?? f))} against the receipt`,
    );
  }
  if (open.includes("UNKNOWN_CATEGORY")) missing.push("choose a category");
  if (open.includes("FX_RATE_UNAVAILABLE")) {
    missing.push(
      `note there is no ${e?.currency.value ?? ""} exchange rate, so it is left out of totals`,
    );
  }
  if (missing.length > 0) return `${sentence(list(missing))}.`;
  if (open.includes("AMBIGUOUS_MATCH")) {
    const n = r.match?.candidates.filter((c) => c.score >= 40).length ?? 0;
    return `${n} payments could match. Choose the right one.`;
  }
  if (open.includes("NO_PAYMENT_FOUND")) {
    return "No matching payment on the statement. Choose one, or remove the receipt until it appears.";
  }
  if (r.state.reimbursement) {
    return `Paid personally, with no statement line. Approve to reimburse ${personLabel(r.submitterId)}.`;
  }
  const chosen = r.match?.candidates.find((c) => c.statementLineId === r.match?.statementLineId);
  const why = chosen ? `${sentence(chosen.reasons.join(", "))}.` : "";
  if (r.state.status === "amount_differs") return `${why} Difference signed off. Ready to approve.`;
  return `${why} Ready to approve.`.trim();
}

/** What the person should do with a statement line that has no receipt (R-MAT-7). */
export function lineNextStep(n: NoReceiptLine): string {
  if (n.resolution?.kind === "substitute") return `Substitute recorded (${n.resolution.category}).`;
  if (n.resolution?.kind === "not_expense") return "Marked not an expense.";
  if (isCredit(n.line)) {
    return "A refund or credit, not a payment. Record it against the category it reduces, or mark it not an expense.";
  }
  if (n.candidateFor.length > 0) {
    return `No receipt yet, but it could be the payment for ${list(n.candidateFor)}. Link it, or resolve it another way.`;
  }
  return "A payment with no receipt. Link a receipt, record a substitute, or mark it not an expense.";
}
