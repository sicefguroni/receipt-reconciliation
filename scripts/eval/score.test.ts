import { describe, expect, it } from "vitest";
import type { GroundTruthReceipt } from "../dataset/schema";
import { codeFlags, parseAnswerTable } from "./answer-sheet";
import { plantedExceptions, scoreRun, vendorSimilarity } from "./score";

function truth(id: string, over: Partial<GroundTruthReceipt> = {}): GroundTruthReceipt {
  return {
    id,
    testCases: [],
    fileKind: "pdf",
    fields: {
      vendor: "Sample Café",
      date: "2026-10-02",
      total: 18.5,
      currency: "AUD",
      tax: 1.68,
      summary: "",
    },
    isReceipt: true,
    category: "Meals & Entertainment",
    statementLineId: "L01",
    matchStatus: "matched",
    exceptions: [],
    reimbursement: false,
    excludedFromTotals: false,
    ledgerAmountAud: 18.5,
    amountDifferenceAud: 0,
    duplicateOf: null,
    ...over,
  };
}

const exact = {
  vendor: "Sample Café",
  date: "2026-10-02",
  total: 18.5,
  currency: "AUD",
  category: "Meals & Entertainment",
};

describe("vendorSimilarity", () => {
  it("ignores case, accents, and punctuation", () => {
    expect(vendorSimilarity("SAMPLE CAFE", "Sample Café")).toBe(1);
    expect(vendorSimilarity("Nimbus Compute Inc", "Nimbus Compute Inc.")).toBe(1);
  });
  it("rejects a different vendor", () => {
    expect(vendorSimilarity("Metro Taxi Co.", "Sample Café")).toBeLessThan(0.8);
  });
});

describe("plantedExceptions", () => {
  it("TC04: the planted problem is the over-threshold difference, not the routing code", () => {
    const t = truth("R04", {
      exceptions: ["AMBIGUOUS_MATCH"],
      exceptionsAfterMatchChoice: ["AMOUNT_DIFFERS_OVER_THRESHOLD"],
    });
    expect(plantedExceptions(t)).toEqual(["AMOUNT_DIFFERS_OVER_THRESHOLD"]);
  });
});

describe("scoreRun", () => {
  it("scores a perfect run as perfect", () => {
    const s = scoreRun(
      [truth("R01")],
      [{ receiptId: "R01", ...exact, statementLineId: "L01", exceptions: [] }],
    );
    expect(s.extraction.total.rate).toBe(1);
    expect(s.category.rate).toBe(1);
    expect(s.matchRecall.rate).toBe(1);
    expect(s.wrongMatchRate.rate).toBe(0);
  });

  it("counts a line given to a receipt that has none as a wrong match", () => {
    const s = scoreRun(
      [truth("R20", { statementLineId: null, exceptions: ["NO_PAYMENT_FOUND"] })],
      [{ receiptId: "R20", ...exact, statementLineId: "L37", exceptions: [] }],
    );
    expect(s.wrongMatchRate).toEqual({ hit: 1, of: 1, rate: 1 });
    expect(s.matchRecall.of).toBe(0); // not matchable
    expect(s.cases[0]?.missed).toEqual(["NO_PAYMENT_FOUND"]);
  });

  it("separates recall (planted and caught) from precision (fired and right)", () => {
    const s = scoreRun(
      [truth("R08"), truth("R09", { statementLineId: null, exceptions: ["DUPLICATE"] })],
      [
        { receiptId: "R08", ...exact, statementLineId: "L01", exceptions: ["DUPLICATE"] },
        { receiptId: "R09", ...exact, statementLineId: null, exceptions: ["DUPLICATE"] },
      ],
    );
    expect(s.exceptionRecall.DUPLICATE).toEqual({ hit: 1, of: 1, rate: 1 });
    expect(s.exceptionPrecision.DUPLICATE).toEqual({ hit: 1, of: 2, rate: 0.5 });
    expect(s.headlineExceptionRecall.rate).toBe(1);
  });

  it("treats a missing prediction as wrong on every field", () => {
    const s = scoreRun([truth("R01")], []);
    expect(s.extraction.total.hit).toBe(0);
    expect(s.matchRecall.hit).toBe(0);
  });
});

describe("answer sheet parsing", () => {
  it("codes free-text flags with the fixed rules", () => {
    expect(codeFlags("Missing business purpose")).toEqual(["MISSING_PURPOSE"]);
    expect(codeFlags("Duplicate receipt: R09, R10")).toEqual(["DUPLICATE"]);
    expect(codeFlags("Possible duplicate card charge")).toEqual(["AMBIGUOUS_MATCH"]);
    expect(codeFlags("Sign-off required: amount mismatch")).toEqual([
      "AMOUNT_DIFFERS_OVER_THRESHOLD",
    ]);
    expect(codeFlags("")).toEqual([]);
  });

  it("parses a markdown table, including tentative lines and escaped characters", () => {
    const rows = parseAnswerTable(`
| Receipt | Vendor | Date | Total | Currency | Category | Statement line | Flags | Notes |
|---|---|---|---|---|---|---|---|---|
| R13 | Station Kiosk Cafe | 2026-10-20 | 14.70 | AUD | Meals & Entertainment | none |  | Card \\*\\*\\*\\*7350 |
| R20 | Sample Harbour Hotel | 2026-10-31 | 268.00 | AUD | Travel | L37 (tentative) | Approval required | x |
`);
    expect(rows[0]?.prediction).toMatchObject({
      receiptId: "R13",
      total: 14.7,
      statementLineId: null,
    });
    expect(rows[0]?.cells.notes).toBe("Card ****7350");
    expect(rows[1]?.prediction.statementLineId).toBe("L37");
    expect(rows[1]?.tentativeLine).toBe(true);
  });
});
