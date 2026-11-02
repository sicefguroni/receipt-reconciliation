import { z } from "zod";
import {
  CategoryName,
  ExceptionCode,
  IsoDate,
  MatchStatus,
  MonthKey,
  PaymentSource,
  StatementLine,
} from "@/core/schemas";

// Files written to fixtures/dataset. The eval harness parses them with these schemas.

export const TestCaseId = z.enum([
  "TC01",
  "TC02",
  "TC03",
  "TC04",
  "TC05",
  "TC06",
  "TC07",
  "TC08",
  "TC09",
  "TC10",
  "TC11",
  "TC12",
]);
export type TestCaseId = z.infer<typeof TestCaseId>;

export const FileKind = z.enum(["pdf", "png", "photo"]);
export type FileKind = z.infer<typeof FileKind>;

// receipts.json: what the system receives at intake (matches ReceiptInput in 04).
export const IntakeReceipt = z.object({
  id: z.string(),
  monthKey: MonthKey,
  submitterId: z.string(),
  paymentSource: PaymentSource,
  businessPurpose: z.string().optional(),
  uploadOrder: z.number().int().positive(),
  file: z.object({
    path: z.string(),
    mime: z.enum(["image/jpeg", "image/png", "application/pdf"]),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    sha256: z.string().length(64),
  }),
});
export type IntakeReceipt = z.infer<typeof IntakeReceipt>;

export const Intake = z.object({
  monthKey: MonthKey,
  receipts: z.array(IntakeReceipt),
});

// ground-truth.json: what the system should produce. Written from scenario intent,
// never computed by src/core, so the eval does not grade the rules against themselves.
export const GroundTruthReceipt = z.object({
  id: z.string(),
  testCases: z.array(TestCaseId),
  fileKind: FileKind,
  fields: z.object({
    vendor: z.string(),
    date: IsoDate,
    total: z.number(),
    currency: z.string().length(3),
    tax: z.number().nullable(),
    summary: z.string(),
  }),
  isReceipt: z.boolean(),
  category: CategoryName,
  statementLineId: z.string().nullable(),
  matchStatus: MatchStatus,
  exceptions: z.array(ExceptionCode),
  reimbursement: z.boolean(),
  excludedFromTotals: z.boolean(),
  ledgerAmountAud: z.number().nullable(),
  duplicateOf: z.string().nullable(),
  note: z.string().optional(),
});
export type GroundTruthReceipt = z.infer<typeof GroundTruthReceipt>;

export const GroundTruth = z.object({
  monthKey: MonthKey,
  generatedBy: z.string(),
  seed: z.number().int(),
  receipts: z.array(GroundTruthReceipt),
  statementLines: z.array(
    StatementLine.extend({ receiptId: z.string().nullable(), note: z.string().optional() }),
  ),
});
export type GroundTruth = z.infer<typeof GroundTruth>;

export const Splits = z.object({
  tuning: z.array(z.string()),
  holdout: z.array(z.string()),
});
export type Splits = z.infer<typeof Splits>;

export const BaselineSubset = z.object({
  receiptIds: z.array(z.string()).length(20),
  why: z.record(z.string(), z.string()),
});
export type BaselineSubset = z.infer<typeof BaselineSubset>;
