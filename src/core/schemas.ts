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

/** Fields a person can correct on a receipt (04, human approval point 4). */
export const CorrectableField = z.enum([
  "vendor",
  "date",
  "total",
  "currency",
  "tax",
  "summary",
  "businessPurpose",
  "paymentSource",
  "category",
]);
export type CorrectableField = z.infer<typeof CorrectableField>;

/**
 * What each human action changes. Statuses are never stored: they are derived again from the
 * pipeline's findings plus these changes (CLAUDE.md non-negotiable 3).
 */
export const DecisionChange = z.discriminatedUnion("action", [
  // The match at the moment of approval; an approved item keeps it (approved items are locked).
  z.object({
    action: z.literal("approve"),
    after: z.object({ statementLineId: z.string().nullable(), reimbursement: z.boolean() }),
  }),
  z.object({
    action: z.literal("correct_field"),
    after: z.object({
      field: CorrectableField,
      value: z.string().nullable(),
      /** R-CAT-4: "Always use this category for <vendor>". */
      alwaysForVendor: z.boolean().optional(),
    }),
  }),
  // R-MAT-5: a chosen line, or null for "paid personally, reimburse (no statement line)".
  z.object({
    action: z.literal("choose_match"),
    after: z.object({ statementLineId: z.string().nullable() }),
  }),
  // R-MAT-10: one receipt paid by several lines; the first is the one reported. Replaces any
  // earlier choice for the receipt, like choose_match.
  z.object({
    action: z.literal("split_payment"),
    after: z.object({ statementLineIds: z.array(z.string()).min(2) }),
  }),
  // R-AMT-4: signs off the difference against this line only; needs a reason.
  z.object({
    action: z.literal("sign_off_difference"),
    after: z.object({ statementLineId: z.string() }),
  }),
  // R-DUP-1: confirm (kept on record, excluded) or "not a duplicate" (included; needs a reason).
  z.object({ action: z.literal("resolve_duplicate"), after: z.object({ duplicate: z.boolean() }) }),
  // Take the receipt out of this month (unreadable, not a receipt); the submitter re-uploads.
  z.object({ action: z.literal("request_reupload"), after: z.object({}) }),
  // R-MAT-7, on a statement line: link a receipt, record a substitute, or not an expense.
  z.object({ action: z.literal("link_receipt"), after: z.object({ receiptId: z.string() }) }),
  z.object({
    action: z.literal("record_substitute"),
    // R-CAT-6: a category other than the suggested one needs the person's explicit say-so.
    after: z.object({ category: z.string().min(1), overrideSuggestion: z.boolean().optional() }),
  }),
  z.object({ action: z.literal("mark_not_expense"), after: z.object({}) }),
]);
export type DecisionChange = z.infer<typeof DecisionChange>;
export type DecisionAction = DecisionChange["action"];

// Every human action is one immutable row (04, Decision).
export const Decision = z
  .object({
    id: z.string(),
    subjectId: z.string(), // a receipt id, or a statement line id for R-MAT-7 actions
    actorId: z.string(),
    before: z.unknown(),
    reason: z.string().trim().min(3).nullish(),
    at: z.string(),
  })
  .and(DecisionChange);
export type Decision = z.infer<typeof Decision>;
