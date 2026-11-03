import type { ExceptionCode, PaymentSource, StatementAccount } from "./schemas";

// Required-information rules R-REQ-1 to R-REQ-3 (docs/sprint/05-business-rules.md).

const PLACEHOLDER_PURPOSES = new Set(["n/a", "na", "n.a.", "-", "--", ".", "none", "nil", "null"]);

/**
 * R-REQ-1: a missing or blank purpose, or a placeholder such as "n/a", "-", or "none",
 * flags MISSING_PURPOSE. The item cannot be approved until a real purpose is added.
 */
export function checkBusinessPurpose(purpose: string | null | undefined): ExceptionCode[] {
  const text = purpose?.trim().toLowerCase() ?? "";
  return text === "" || PLACEHOLDER_PURPOSES.has(text) ? ["MISSING_PURPOSE"] : [];
}

const SOURCE_LABELS: Record<PaymentSource, string> = {
  company_card: "Company card",
  personal_card: "Personal card",
  bank: "Bank account",
  unknown: "Unknown — set payment source", // R-REQ-2: visible and fixable, not a dead end
};

/** R-REQ-2: `unknown` is allowed and shown with a prompt to set it. Not an exception. */
export function paymentSourceLabel(source: PaymentSource): string {
  return SOURCE_LABELS[source];
}

/**
 * R-REQ-3: each payment source matches one kind of statement account (the +5 account
 * point in R-MAT). There is no `unknown` statement account, so an unknown source never
 * earns the point.
 */
export function accountMatchesSource(source: PaymentSource, account: StatementAccount): boolean {
  return source === account;
}
