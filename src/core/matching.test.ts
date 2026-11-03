import { describe, expect, it } from "vitest";
import {
  applyChosenLine,
  inMatchWindow,
  linesWithoutReceipt,
  type MatchPolicy,
  type MatchReceipt,
  matchReceipts,
  paymentStatus,
  rankCandidates,
  scorePair,
  vendorSimilarity,
} from "./matching";
import type { StatementLine } from "./schemas";

const policy: MatchPolicy = {
  pctThreshold: 10,
  audThreshold: 100,
  minScore: 75,
  minMargin: 20,
  maxDaysApart: 7,
};

const receipt = (overrides: Partial<MatchReceipt> = {}): MatchReceipt => ({
  id: "R1",
  total: 18.5,
  currency: "AUD",
  date: "2026-10-02",
  vendor: "Sample Café",
  paymentSource: "company_card",
  ...overrides,
});

const line = (overrides: Partial<StatementLine> = {}): StatementLine => ({
  id: "L1",
  date: "2026-10-02",
  description: "SQ *SAMPLE CAFE SAMPLE CITY AU",
  amountAud: 18.5,
  account: "company_card",
  ...overrides,
});

describe("R-MAT scoring table", () => {
  it("scores all signals: amount 50 + date 25 + vendor 20 + account 5", () => {
    expect(scorePair(receipt(), line(), policy).score).toBe(100);
  });

  it("amount within the R-AMT-2 threshold earns 30 instead of 50 (TC05: $42 vs $44)", () => {
    const c = scorePair(receipt({ total: 42 }), line({ amountAud: 44 }), policy);
    expect(c.score).toBe(80);
  });

  it("amount over the threshold earns no amount points (TC04: $500 vs $560, 2 days)", () => {
    const c = scorePair(
      receipt({ total: 500, vendor: "QuickFix Repairs", date: "2026-10-08" }),
      line({ amountAud: 560, date: "2026-10-10", description: "QUICKFIX REPAIRS SAMPLE CITY" }),
      policy,
    );
    expect(c.score).toBe(40); // 15 date + 20 vendor + 5 account
  });

  it("date bands: 0-1 days 25, 2-3 days 15, 4-5 days 5, more 0", () => {
    const at = (date: string) => scorePair(receipt(), line({ date }), policy).score - 75;
    expect([
      at("2026-10-03"),
      at("2026-10-04"),
      at("2026-10-05"),
      at("2026-10-06"),
      at("2026-10-07"),
      at("2026-10-08"),
    ]).toEqual([25, 15, 15, 5, 5, 0]);
  });

  it("vendor similarity is the share of the vendor's words found in the description", () => {
    expect(vendorSimilarity("Sample Café", "SQ *SAMPLE CAFE SAMPLE CITY AU")).toBe(1);
    expect(vendorSimilarity("Metro Taxi Co.", "METRO TAXI CO SAMPLE CITY")).toBe(1);
    expect(vendorSimilarity("Sample Café", "SAMPLE PHARMACY")).toBe(0.5);
    expect(vendorSimilarity("Sample Harbour Hotel", "SAMPLE PHARMACY")).toBeCloseTo(1 / 3);
  });

  it("vendor: >= 0.6 earns 20, >= 0.3 earns 10", () => {
    const partly = scorePair(receipt(), line({ description: "SAMPLE PHARMACY" }), policy);
    expect(partly.score).toBe(90);
    expect(partly.reasons).toContain("vendor name partly matches");
  });

  it("R-MAT-6: every candidate carries plain-language reasons", () => {
    expect(scorePair(receipt(), line(), policy).reasons).toEqual([
      "same amount",
      "same day",
      "vendor name matches",
      "paid from the stated account",
    ]);
  });

  it("R-CUR-4: a USD receipt matches on the original amount; the FX fee is no difference", () => {
    const c = scorePair(
      receipt({ total: 49, currency: "USD", vendor: "Nimbus Compute Inc.", date: "2026-10-05" }),
      line({
        date: "2026-10-06",
        amountAud: 77.12,
        originalAmount: { amount: 49, currency: "USD" },
        description: "NIMBUS COMPUTE INC 800-555-0100 US",
      }),
      policy,
    );
    expect(c.score).toBe(100);
  });

  it("a receipt without a total has no candidates", () => {
    expect(rankCandidates(receipt({ total: null }), [line()], policy)).toEqual([]);
  });

  it("only lines in the month plus 5 days either side are considered", () => {
    expect(inMatchWindow("2026-09-26", "2026-10")).toBe(true);
    expect(inMatchWindow("2026-09-25", "2026-10")).toBe(false);
    expect(inMatchWindow("2026-11-05", "2026-10")).toBe(true);
    expect(inMatchWindow("2026-11-06", "2026-10")).toBe(false);
  });
});

describe("R-MAT-8 credits are never a receipt's payment", () => {
  it("a refund with the same vendor, date, and account is not a candidate", () => {
    // Before R-MAT-8 this scored 50 (date 25 + vendor 20 + account 5): an ambiguous match.
    const refund = line({ id: "L2", amountAud: -18.5 });
    expect(rankCandidates(receipt(), [refund], policy)).toEqual([]);
  });

  it("with only the refund on the statement, the receipt has no payment found", () => {
    const [outcome] = matchReceipts(
      [receipt()],
      [line({ id: "L2", amountAud: -18.5 })],
      "2026-10",
      policy,
    );
    expect(outcome?.status).toBe("unmatched");
    expect(outcome?.exceptions).toEqual(["NO_PAYMENT_FOUND"]);
  });

  it("a purchase and its refund: matched to the purchase, the refund stays unmatched", () => {
    const purchase = line({ id: "L1" });
    const refund = line({ id: "L2", date: "2026-10-05", amountAud: -18.5 });
    const [outcome] = matchReceipts([receipt()], [purchase, refund], "2026-10", policy);
    expect(outcome?.statementLineId).toBe("L1");
    expect(outcome?.candidates.map((c) => c.statementLineId)).toEqual(["L1"]);
    expect(linesWithoutReceipt([purchase, refund], ["L1"]).map((l) => l.id)).toEqual(["L2"]);
  });
});

describe("R-MAT-9 date gate", () => {
  // R13 on the 20-receipt subset (Day 2 finding): a $14.70 coffee with no line was pushed to
  // `ambiguous` by a $15.50 cafe line 15 days earlier (amount within policy 30 + vendor 10).
  const coffee = receipt({ total: 14.7, date: "2026-10-17", vendor: "Harbour Lane Cafe" });
  const far = line({ date: "2026-10-02", amountAud: 15.5, description: "SQ *SAMPLE CAFE" });

  it("a line more than maxDaysApart from the receipt date is not a candidate", () => {
    expect(scorePair(coffee, far, policy).score).toBe(45); // what it scored before the gate
    expect(rankCandidates(coffee, [far], policy)).toEqual([]);
  });

  it("the boundary is inclusive: exactly maxDaysApart is still a candidate", () => {
    const sevenDays = line({
      date: "2026-10-10",
      amountAud: 14.7,
      description: "HARBOUR LANE CAFE",
    });
    const eightDays = line({
      id: "L2",
      date: "2026-10-09",
      amountAud: 14.7,
      description: "HARBOUR LANE CAFE",
    });
    expect(
      rankCandidates(coffee, [sevenDays, eightDays], policy).map((c) => c.statementLineId),
    ).toEqual(["L1"]);
  });

  it("a receipt with no date is not gated (its date is for a person to fix)", () => {
    expect(rankCandidates({ ...coffee, date: null }, [far], policy)).not.toEqual([]);
  });
});

describe("vendor similarity: wordmarks (Day 4, F5)", () => {
  it("a logo read as one word matches the bank's spaced name, and the reverse", () => {
    expect(vendorSimilarity("brightreachads", "BRIGHTREACH ADS SAMPLE CITY AU")).toBe(1);
    expect(vendorSimilarity("Bright Reach Ads", "BRIGHTREACHADS SAMPLE CITY")).toBe(1);
  });

  it("whole words only: a short name inside another word does not match", () => {
    expect(vendorSimilarity("Ace", "PLACEMENT AGENCY")).toBe(0);
    expect(vendorSimilarity("samplec", "SAMPLE CAFE")).toBe(0);
  });
});

describe("R-MAT match decisions", () => {
  it("R-MAT-1: auto-matches when best >= 75 and beats the runner-up by >= 20 (TC01)", () => {
    const [outcome] = matchReceipts([receipt()], [line()], "2026-10", policy);
    expect(outcome).toMatchObject({ status: "matched", statementLineId: "L1", exceptions: [] });
  });

  it("R-MAT-1: a margin of exactly 20 is enough (R27 vs its same-day distractor)", () => {
    const taxi = receipt({ total: 28.7, vendor: "Metro Taxi Co.", date: "2026-10-27" });
    const lines = [
      line({
        id: "L39",
        date: "2026-10-27",
        amountAud: 28.7,
        description: "METRO TAXI CO SAMPLE CITY",
      }),
      line({
        id: "L40",
        date: "2026-10-27",
        amountAud: 31.2,
        description: "METRO TAXI CO SAMPLE CITY",
      }),
    ];
    const [outcome] = matchReceipts([taxi], lines, "2026-10", policy);
    expect(outcome?.candidates.map((c) => c.score)).toEqual([100, 80]);
    expect(outcome).toMatchObject({ status: "matched", statementLineId: "L39" });
  });

  it("R-MAT-1: a margin under 20 is not enough", () => {
    const strict: MatchPolicy = { ...policy, minMargin: 21 };
    const taxi = receipt({ total: 28.7, vendor: "Metro Taxi Co.", date: "2026-10-27" });
    const lines = [
      line({ id: "L39", date: "2026-10-27", amountAud: 28.7, description: "METRO TAXI CO" }),
      line({ id: "L40", date: "2026-10-27", amountAud: 31.2, description: "METRO TAXI CO" }),
    ];
    expect(matchReceipts([taxi], lines, "2026-10", strict)[0]?.status).toBe("ambiguous");
  });

  it("R-MAT-2: two equal lines on adjacent days are ambiguous with both ranked, never auto-picked (TC11)", () => {
    const app = receipt({ total: 19.99, vendor: "Sample App Store", date: "2026-10-14" });
    const lines = [
      line({ id: "L22", date: "2026-10-14", amountAud: 19.99, description: "SAMPLE APP STORE" }),
      line({ id: "L24", date: "2026-10-15", amountAud: 19.99, description: "SAMPLE APP STORE" }),
    ];
    const [outcome] = matchReceipts([app], lines, "2026-10", policy);
    expect(outcome).toMatchObject({
      status: "ambiguous",
      statementLineId: null,
      exceptions: ["AMBIGUOUS_MATCH"],
    });
    expect(outcome?.candidates.map((c) => c.statementLineId)).toEqual(["L22", "L24"]);
  });

  it("R-MAT-2: an over-threshold line at exactly 40 points is a candidate, not a match (TC04)", () => {
    const repair = receipt({ total: 500, vendor: "QuickFix Repairs", date: "2026-10-08" });
    const l16 = line({
      id: "L16",
      amountAud: 560,
      date: "2026-10-10",
      description: "QUICKFIX REPAIRS",
    });
    const [outcome] = matchReceipts([repair], [l16], "2026-10", policy);
    expect(outcome).toMatchObject({ status: "ambiguous", exceptions: ["AMBIGUOUS_MATCH"] });
    expect(outcome?.candidates[0]).toMatchObject({ statementLineId: "L16", score: 40 });
  });

  it("R-MAT-2: shows at most 3 candidates", () => {
    const lines = ["L1", "L2", "L3", "L4"].map((id) => line({ id }));
    const [outcome] = matchReceipts([receipt()], lines, "2026-10", policy);
    expect(outcome?.candidates).toHaveLength(3);
  });

  it("R-MAT-3: below 40 on a company card flags NO_PAYMENT_FOUND (R20)", () => {
    const hotel = receipt({ total: 268, vendor: "Sample Harbour Hotel", date: "2026-10-31" });
    const other = line({ amountAud: 189, date: "2026-10-26", description: "SAMPLE HARBOUR HOTEL" });
    const [outcome] = matchReceipts([hotel], [other], "2026-10", policy);
    expect(outcome).toMatchObject({
      status: "unmatched",
      exceptions: ["NO_PAYMENT_FOUND"],
      reimbursement: false,
    });
  });

  it("R-MAT-3: below 40 on a personal card is a reimbursement, not an error (TC10)", () => {
    const coffee = receipt({ paymentSource: "personal_card", total: 14.7, date: "2026-10-20" });
    const [outcome] = matchReceipts([coffee], [], "2026-10", policy);
    expect(outcome).toMatchObject({ status: "unmatched", exceptions: [], reimbursement: true });
  });

  it("R-MAT-3: an unknown payment source with no line is NO_PAYMENT_FOUND, not a reimbursement", () => {
    const [outcome] = matchReceipts([receipt({ paymentSource: "unknown" })], [], "2026-10", policy);
    expect(outcome).toMatchObject({ exceptions: ["NO_PAYMENT_FOUND"], reimbursement: false });
  });

  it("R-MAT-4: a line goes to at most one receipt; the higher-scoring receipt takes it", () => {
    // Two receipts both fit L1; the exact one (100) takes it, the other (80) must not reuse it.
    const exact = receipt({ id: "RA" });
    const near = receipt({ id: "RB", total: 19.5 });
    const outcomes = matchReceipts([near, exact], [line()], "2026-10", policy);
    expect(outcomes.map((o) => [o.receiptId, o.statementLineId])).toEqual([
      ["RB", null],
      ["RA", "L1"],
    ]);
  });

  it("R-MAT-4: one payment is never assigned to an original and its copies (B1's failure)", () => {
    const copies = ["R08", "R09", "R10"].map((id) => receipt({ id, total: 312 }));
    const outcomes = matchReceipts(copies, [line({ amountAud: 312 })], "2026-10", policy);
    expect(outcomes.filter((o) => o.statementLineId === "L1")).toHaveLength(1);
  });

  it("R-MAT-5: a human choice of an over-threshold line sets amount_differs and fires the flag (TC04)", () => {
    const repair = receipt({ total: 500, vendor: "QuickFix Repairs", date: "2026-10-08" });
    const l16 = line({ id: "L16", amountAud: 560, date: "2026-10-10" });
    expect(applyChosenLine(repair, l16, policy)).toMatchObject({
      status: "amount_differs",
      statementLineId: "L16",
      exceptions: ["AMOUNT_DIFFERS_OVER_THRESHOLD"],
    });
  });

  it("R-MAT-5: a human choice within the threshold is a normal match (TC11 after choice)", () => {
    expect(applyChosenLine(receipt(), line(), policy)).toMatchObject({
      status: "matched",
      exceptions: [],
    });
  });

  it("R-MAT-5: paid if and only if matched or amount_differs with a line", () => {
    expect(paymentStatus("matched", "L1")).toBe("paid");
    expect(paymentStatus("amount_differs", "L1")).toBe("paid");
    expect(paymentStatus("matched", null)).toBe("unpaid");
    expect(paymentStatus("ambiguous", null)).toBe("unpaid");
    expect(paymentStatus("unmatched", null)).toBe("unpaid");
  });

  it("R-MAT-7: every line not matched to a receipt is listed as 'No receipt'", () => {
    const lines = [line({ id: "L1" }), line({ id: "L2" }), line({ id: "L3" })];
    expect(linesWithoutReceipt(lines, ["L2"]).map((l) => l.id)).toEqual(["L1", "L3"]);
  });
});
