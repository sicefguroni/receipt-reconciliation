import { describe, expect, it } from "vitest";
import { buildDataset } from "./scenarios";
import { BaselineSubset, GroundTruth, Splits, TestCaseId } from "./schema";

// These check the dataset spec itself (06, "Dataset" and "Test cases"), not the system.
const ds = buildDataset();
const truth = ds.receipts.map((r) => r.truth);
const byId = new Map(truth.map((t) => [t.id, t]));

describe("dataset spec", () => {
  it("is deterministic", () => {
    expect(JSON.stringify(buildDataset())).toBe(JSON.stringify(ds));
  });

  it("parses against the ground-truth schema", () => {
    expect(() =>
      GroundTruth.parse({
        monthKey: ds.monthKey,
        generatedBy: "test",
        seed: ds.seed,
        receipts: truth,
        statementLines: ds.statementLines,
      }),
    ).not.toThrow();
    expect(() => Splits.parse(ds.splits)).not.toThrow();
    expect(() => BaselineSubset.parse(ds.baselineSubset)).not.toThrow();
  });

  it("has about 40 receipts and about 45 statement lines", () => {
    expect(ds.receipts.length).toBeGreaterThanOrEqual(36);
    expect(ds.receipts.length).toBeLessThanOrEqual(44);
    expect(ds.statementLines.length).toBeGreaterThanOrEqual(40);
    expect(ds.statementLines.length).toBeLessThanOrEqual(50);
  });

  it("covers every test case TC01 to TC12", () => {
    const covered = new Set(truth.flatMap((t) => t.testCases));
    for (const tc of TestCaseId.options) expect(covered, tc).toContain(tc);
  });

  it("has at least 25 routine items (matched, no exceptions)", () => {
    const routine = truth.filter((t) => t.matchStatus === "matched" && t.exceptions.length === 0);
    expect(routine.length).toBeGreaterThanOrEqual(25);
  });

  it("has about 30% phone photos", () => {
    const share = ds.receipts.filter((r) => r.fileKind === "photo").length / ds.receipts.length;
    expect(share).toBeGreaterThanOrEqual(0.25);
    expect(share).toBeLessThanOrEqual(0.4);
  });

  it("links every receipt to an existing line, and each line to at most one receipt", () => {
    const lineIds = new Set(ds.statementLines.map((l) => l.id));
    expect(lineIds.size).toBe(ds.statementLines.length);
    const used = truth.flatMap((t) => (t.statementLineId ? [t.statementLineId] : []));
    for (const id of used) expect(lineIds).toContain(id);
    expect(new Set(used).size).toBe(used.length);
    for (const line of ds.statementLines.filter((l) => l.receiptId)) {
      expect(byId.get(line.receiptId ?? "")?.statementLineId).toBe(line.id);
    }
  });

  it("keeps every statement line inside the month", () => {
    for (const l of ds.statementLines) expect(l.date.startsWith(ds.monthKey), l.id).toBe(true);
  });

  it("TC02: USD line carries the original amount, and the AUD charge is the ledger amount", () => {
    const r = byId.get("R02");
    const line = ds.statementLines.find((l) => l.id === r?.statementLineId);
    expect(line?.originalAmount).toEqual({ amount: r?.fields.total, currency: "USD" });
    expect(r?.ledgerAmountAud).toBe(line?.amountAud);
    expect(r?.exceptions).toEqual([]);
  });

  it("TC04: charged amount is 12% over the receipt (over the 10% threshold)", () => {
    const r = byId.get("R04");
    const line = ds.statementLines.find((l) => l.id === r?.statementLineId);
    expect(r?.fields.total).toBe(500);
    expect(line?.amountAud).toBe(560);
  });

  it("TC04: never auto-paired; the over-threshold flag fires only after the human chooses the line", () => {
    const r = byId.get("R04");
    expect(r?.matchStatus).toBe("ambiguous");
    expect(r?.exceptions).toEqual(["AMBIGUOUS_MATCH"]);
    expect(r?.exceptionsAfterMatchChoice).toEqual(["AMOUNT_DIFFERS_OVER_THRESHOLD"]);
    expect(r?.statementLineId).not.toBeNull();
  });

  it("TC05: tip difference is under both the 10% and $100 thresholds", () => {
    const r = byId.get("R05");
    const line = ds.statementLines.find((l) => l.id === r?.statementLineId);
    const diff = (line?.amountAud ?? 0) - (r?.fields.total ?? 0);
    expect(diff).toBeCloseTo(2, 2);
    expect(diff / (r?.fields.total ?? 1)).toBeLessThan(0.1);
  });

  it("TC05: a small difference is a normal match with a difference badge (R-AMT-3)", () => {
    const r = byId.get("R05");
    expect(r?.matchStatus).toBe("matched");
    expect(r?.exceptions).toEqual([]);
    expect(r?.amountDifferenceAud).toBe(2);
  });

  it("amount difference is zero for exact and foreign-currency matches, null without a line", () => {
    expect(byId.get("R01")?.amountDifferenceAud).toBe(0);
    expect(byId.get("R02")?.amountDifferenceAud).toBe(0); // FX fee is not a difference
    expect(byId.get("R13")?.amountDifferenceAud).toBeNull();
  });

  it("R-REQ-3: direct-debit receipts carry the bank payment source and a bank line", () => {
    for (const id of ["R24", "R37"]) {
      const r = ds.receipts.find((x) => x.id === id);
      const line = ds.statementLines.find((l) => l.id === r?.truth.statementLineId);
      expect(r?.intake.paymentSource, id).toBe("bank");
      expect(line?.account, id).toBe("bank");
    }
  });

  it("TC06: blank and 'n/a' purposes are both expected to flag MISSING_PURPOSE", () => {
    for (const id of ["R06", "R07"]) {
      const purpose = ds.receipts.find((r) => r.id === id)?.intake.businessPurpose?.trim();
      expect(["", "n/a"]).toContain(purpose);
      expect(byId.get(id)?.exceptions).toContain("MISSING_PURPOSE");
    }
  });

  it("TC07: duplicates copy the original's fields, have no line, and are excluded from totals", () => {
    const original = byId.get("R08");
    for (const id of ["R09", "R10"]) {
      const dup = byId.get(id);
      expect(dup?.fields).toEqual(original?.fields);
      expect(dup?.duplicateOf).toBe("R08");
      expect(dup?.statementLineId).toBeNull();
      expect(dup?.excludedFromTotals).toBe(true);
      expect(dup?.exceptions).toEqual(["DUPLICATE"]);
    }
    expect(ds.receipts.find((r) => r.id === "R09")?.fileKind).toBe("pdf");
    expect(ds.receipts.find((r) => r.id === "R10")?.fileKind).toBe("photo");
  });

  it("TC08: the portrait photo is exactly 900 x 1200", () => {
    const photo = ds.receipts.find((r) => r.id === "R11")?.photo;
    expect(photo?.width).toBe(900);
    expect(photo?.height).toBe(1200);
  });

  it("phone photos all pass the R-QUA-1 default gate (long >= 1000, short >= 700)", () => {
    for (const r of ds.receipts.filter((x) => x.photo)) {
      const { width = 0, height = 0 } = r.photo ?? {};
      expect(Math.max(width, height), r.id).toBeGreaterThanOrEqual(1000);
      expect(Math.min(width, height), r.id).toBeGreaterThanOrEqual(700);
      expect(Math.abs(r.photo?.angle ?? 0), r.id).toBeGreaterThanOrEqual(3);
      expect(Math.abs(r.photo?.angle ?? 0), r.id).toBeLessThanOrEqual(8);
    }
  });

  it("TC10: personal-card receipts with no line are reimbursements, not errors", () => {
    for (const id of ["R13", "R14"]) {
      const r = byId.get(id);
      expect(r?.statementLineId).toBeNull();
      expect(r?.reimbursement).toBe(true);
      expect(r?.exceptions).toEqual([]);
    }
  });

  it("TC11: two lines with the receipt's amount on adjacent days", () => {
    const r = byId.get("R15");
    const twins = ds.statementLines.filter(
      (l) => l.amountAud === r?.fields.total && l.description.includes("APP STORE"),
    );
    expect(twins).toHaveLength(2);
    expect(r?.matchStatus).toBe("ambiguous");
  });

  it("R-DUP-2: same vendor and amount on different dates is not a duplicate", () => {
    expect(byId.get("R21")?.fields.total).toBe(byId.get("R22")?.fields.total);
    expect(byId.get("R21")?.fields.date).not.toBe(byId.get("R22")?.fields.date);
    expect(byId.get("R22")?.exceptions).toEqual([]);
  });

  it("never expects the 'Other' category (R-CAT-3)", () => {
    expect(truth.filter((t) => t.category === "Other")).toEqual([]);
  });

  it("splits are disjoint, cover everything, are about 60/40, and keep duplicates together", () => {
    const { tuning, holdout } = ds.splits;
    expect(new Set([...tuning, ...holdout]).size).toBe(truth.length);
    expect(tuning.filter((id) => holdout.includes(id))).toEqual([]);
    const share = tuning.length / truth.length;
    expect(share).toBeGreaterThanOrEqual(0.55);
    expect(share).toBeLessThanOrEqual(0.65);
    const side = (id: string) => (tuning.includes(id) ? "tuning" : "holdout");
    expect(side("R09")).toBe(side("R08"));
    expect(side("R10")).toBe(side("R08"));
  });

  it("holdout gets hard cases too, so its metrics are not just the routine items", () => {
    const hard = (id: string) => {
      const t = byId.get(id);
      return Boolean(t && (t.exceptions.length > 0 || t.matchStatus !== "matched"));
    };
    expect(ds.splits.holdout.filter(hard).length).toBeGreaterThanOrEqual(3);
    expect(ds.splits.tuning.filter(hard).length).toBeGreaterThanOrEqual(3);
  });

  it("baseline subset has 20 items including TC04, TC06, TC07, TC11, and 4+ routine", () => {
    const ids = ds.baselineSubset.receiptIds;
    expect(ids).toHaveLength(20);
    const tcs = new Set(ids.flatMap((id) => byId.get(id)?.testCases ?? []));
    for (const tc of ["TC04", "TC06", "TC07", "TC11"]) expect(tcs).toContain(tc);
    const routine = ids.filter(
      (id) => byId.get(id)?.matchStatus === "matched" && byId.get(id)?.exceptions.length === 0,
    );
    expect(routine.length).toBeGreaterThanOrEqual(4);
  });
});
