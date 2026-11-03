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

export const FileMime = z.enum(["image/jpeg", "image/png", "application/pdf"]);
export type FileMime = z.infer<typeof FileMime>;

// What the system receives at intake (04, ReceiptInput). Missing purpose is an
// exception (R-REQ-1), not a parse error.
export const ReceiptIntake = z.object({
  id: z.string(),
  monthKey: MonthKey,
  submitterId: z.string(),
  paymentSource: PaymentSource,
  businessPurpose: z.string().trim().max(500).optional(),
  uploadOrder: z.number().int().positive(),
  file: z.object({
    path: z.string(),
    mime: FileMime,
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    sha256: z.string().length(64),
  }),
});
export type ReceiptIntake = z.infer<typeof ReceiptIntake>;

const field = <T extends z.ZodType>(value: T) =>
  z.object({ value: value.nullable(), confidence: z.number().min(0).max(1) });

// Validated model output (04, Extraction). The model is asked for a looser shape;
// anything that fails this schema triggers one validation retry (04, "Pipeline behaviour").
export const Extraction = z.object({
  isReceipt: z.boolean(),
  vendor: field(z.string().trim().min(1).max(200)),
  date: field(IsoDate),
  total: field(z.number().finite()),
  currency: field(z.string().regex(/^[A-Z]{3}$/)),
  tax: field(z.number().finite()),
  summary: field(z.string().max(200)),
});
export type Extraction = z.infer<typeof Extraction>;

export const CategorySource = z.enum(["rule", "model", "human"]);
export type CategorySource = z.infer<typeof CategorySource>;

export const DecisionAction = z.enum([
  "approve",
  "correct_field",
  "choose_match",
  "override_status",
  "request_reupload",
  "link_receipt", // R-MAT-7: the last three resolve statement lines with no receipt
  "record_substitute",
  "mark_not_expense",
]);
export type DecisionAction = z.infer<typeof DecisionAction>;

// Every human action is one immutable row (04, Decision).
export const Decision = z.object({
  id: z.string(),
  subjectId: z.string(), // a receipt id, or a statement line id for R-MAT-7 actions
  actorId: z.string(),
  action: DecisionAction,
  before: z.unknown(),
  after: z.unknown(),
  reason: z.string().trim().min(3).optional(),
  at: z.string(),
});
export type Decision = z.infer<typeof Decision>;
