import type { ExceptionCode, MatchStatus } from "@/core/schemas";

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

export function money(amount: number | null | undefined, currency = "AUD"): string {
  if (amount === null || amount === undefined) return "—";
  return `${currency === "AUD" ? "$" : `${currency} `}${amount.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
