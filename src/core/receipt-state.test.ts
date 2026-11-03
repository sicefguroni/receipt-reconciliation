import { describe, expect, it } from "vitest";
import { deriveReceiptState, normaliseExceptions, type ReceiptFindings } from "./receipt-state";

const matched: ReceiptFindings = {
  exceptions: [],
  match: { status: "matched", statementLineId: "L03", reimbursement: false },
  matchedLineAmountAud: 18.5,
  receiptAmountAud: 18.5,
  duplicate: false,
};

describe("receipt status and exception derivation", () => {
  it("R-MAT-5: a matched receipt is paid and its ledger amount is the line's AUD charge", () => {
    expect(deriveReceiptState(matched)).toEqual({
      exceptions: [],
      status: "matched",
      paymentStatus: "paid",
      reimbursement: false,
      ledgerAmountAud: 18.5,
      excludedFromTotals: false,
    });
  });

  it("R-CUR-4: a USD receipt's ledger amount is the AUD charged, not a converted rate (TC02)", () => {
    const usd = { ...matched, matchedLineAmountAud: 77.12, receiptAmountAud: 70.53 };
    expect(deriveReceiptState(usd).ledgerAmountAud).toBe(77.12);
  });

  it("R-DUP-1: a duplicate is unmatched, unpaid, and excluded from totals (TC07)", () => {
    const dup: ReceiptFindings = {
      ...matched,
      exceptions: ["DUPLICATE"],
      match: null,
      matchedLineAmountAud: null,
      duplicate: true,
    };
    expect(deriveReceiptState(dup)).toMatchObject({
      exceptions: ["DUPLICATE"],
      status: "unmatched",
      paymentStatus: "unpaid",
      ledgerAmountAud: null,
      excludedFromTotals: true,
    });
  });

  it("R-MAT-3: a reimbursement's ledger amount is the receipt's AUD total (TC10)", () => {
    const personal: ReceiptFindings = {
      ...matched,
      match: { status: "unmatched", statementLineId: null, reimbursement: true },
      matchedLineAmountAud: null,
      receiptAmountAud: 14.7,
    };
    expect(deriveReceiptState(personal)).toMatchObject({
      paymentStatus: "unpaid",
      reimbursement: true,
      ledgerAmountAud: 14.7,
      excludedFromTotals: false,
    });
  });

  it("R-MAT-2: an ambiguous receipt has no ledger amount until a person chooses", () => {
    const ambiguous: ReceiptFindings = {
      ...matched,
      exceptions: ["AMBIGUOUS_MATCH"],
      match: { status: "ambiguous", statementLineId: null, reimbursement: false },
      matchedLineAmountAud: null,
    };
    expect(deriveReceiptState(ambiguous)).toMatchObject({
      ledgerAmountAud: null,
      excludedFromTotals: true,
    });
  });

  it("R-CUR-3: a reimbursement with no FX rate is excluded from totals, never converted at 1", () => {
    const noRate: ReceiptFindings = {
      exceptions: ["FX_RATE_UNAVAILABLE"],
      match: { status: "unmatched", statementLineId: null, reimbursement: true },
      matchedLineAmountAud: null,
      receiptAmountAud: null,
      duplicate: false,
    };
    expect(deriveReceiptState(noRate)).toMatchObject({
      ledgerAmountAud: null,
      excludedFromTotals: true,
    });
  });

  it("exceptions are de-duplicated into one canonical order", () => {
    expect(
      normaliseExceptions(["LOW_CONFIDENCE_FIELD", "MISSING_PURPOSE", "LOW_CONFIDENCE_FIELD"]),
    ).toEqual(["MISSING_PURPOSE", "LOW_CONFIDENCE_FIELD"]);
  });
});
