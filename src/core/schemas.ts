import { z } from "zod";

// Shared vocabulary from docs/sprint/04-system-design.md and 05-business-rules.md.
// Day 2 extends this file with the full data contracts.

export const BASE_CURRENCY = "AUD";

// Default chart (05, R-CAT). Names are displayed exactly as written here (R-CAT-5).
export const DEFAULT_CATEGORIES = [
  "Advertising & Marketing",
  "AI & Cloud",
  "Software",
  "Rent & Workspace",
  "Equipment",
  "Office Supplies",
  "Travel",
  "Meals & Entertainment",
  "Repairs & Maintenance",
  "Utilities",
  "Other",
] as const;
export const CategoryName = z.enum(DEFAULT_CATEGORIES);
export type CategoryName = z.infer<typeof CategoryName>;

export const PaymentSource = z.enum(["company_card", "personal_card", "bank", "unknown"]);
export type PaymentSource = z.infer<typeof PaymentSource>;

export const StatementAccount = z.enum(["company_card", "personal_card", "bank"]);
export type StatementAccount = z.infer<typeof StatementAccount>;

export const MatchStatus = z.enum(["matched", "unmatched", "amount_differs", "ambiguous"]);
export type MatchStatus = z.infer<typeof MatchStatus>;

export const ExceptionCode = z.enum([
  "AMOUNT_DIFFERS_OVER_THRESHOLD",
  "MISSING_PURPOSE",
  "DUPLICATE",
  "NO_PAYMENT_FOUND",
  "AMBIGUOUS_MATCH",
  "LOW_CONFIDENCE_FIELD",
  "UNREADABLE",
  "NOT_A_RECEIPT",
  "SELF_APPROVAL_BLOCKED",
  "FX_RATE_UNAVAILABLE",
  "UNKNOWN_CATEGORY",
]);
export type ExceptionCode = z.infer<typeof ExceptionCode>;

export const Money = z.object({
  amount: z.number().finite(),
  currency: z.string().length(3),
});
export type Money = z.infer<typeof Money>;

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const MonthKey = z.string().regex(/^\d{4}-\d{2}$/);

export const StatementLine = z.object({
  id: z.string(),
  date: IsoDate,
  description: z.string(),
  amountAud: z.number(), // debits positive
  originalAmount: Money.optional(), // when the bank shows a foreign amount
  account: StatementAccount,
});
export type StatementLine = z.infer<typeof StatementLine>;
