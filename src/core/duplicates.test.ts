import { describe, expect, it } from "vitest";
import { type DuplicateCandidate, findDuplicates, normaliseVendor } from "./duplicates";

function receipt(
  id: string,
  uploadOrder: number,
  over: Partial<DuplicateCandidate> = {},
): DuplicateCandidate {
  return {
    id,
    uploadOrder,
    fileHash: `hash-${id}`,
    vendor: "Bayside Catering Co.",
    date: "2026-10-15",
    total: 312,
    currency: "AUD",
    ...over,
  };
}

describe("R-DUP duplicate rules", () => {
  it("R-DUP-1: the same file uploaded twice flags the later upload (TC07, exact copy)", () => {
    const flags = findDuplicates([
      receipt("R08", 1, { fileHash: "abc" }),
      receipt("R09", 2, { fileHash: "abc" }),
    ]);
    expect(flags.get("R09")).toEqual({
      duplicateOf: "R08",
      reason: "same_file",
      excludedFromTotals: true,
    });
    expect(flags.has("R08")).toBe(false);
  });

  it("R-DUP-1: a re-photographed copy with the same details is a duplicate (TC07, re-photo)", () => {
    const flags = findDuplicates([
      receipt("R08", 1),
      receipt("R10", 3, { vendor: "BAYSIDE CATERING CO" }),
    ]);
    expect(flags.get("R10")).toMatchObject({ duplicateOf: "R08", reason: "same_details" });
  });

  it("R-DUP-1: the earliest upload is the original, whatever order the list arrives in", () => {
    const flags = findDuplicates([receipt("R10", 3), receipt("R09", 2), receipt("R08", 1)]);
    expect(flags.get("R09")?.duplicateOf).toBe("R08");
    expect(flags.get("R10")?.duplicateOf).toBe("R08");
    expect(flags.has("R08")).toBe(false);
  });

  it("R-DUP-1: a copy of a copy points at the original", () => {
    const flags = findDuplicates([
      receipt("A", 1, { fileHash: "x" }),
      receipt("B", 2, { fileHash: "y" }), // same details as A
      receipt("C", 3, { fileHash: "y", vendor: "Someone Else" }), // same file as B
    ]);
    expect(flags.get("B")?.duplicateOf).toBe("A");
    expect(flags.get("C")).toMatchObject({ duplicateOf: "A", reason: "same_file" });
  });

  it("R-DUP-1: a different total, currency, or vendor is not a duplicate", () => {
    const flags = findDuplicates([
      receipt("A", 1),
      receipt("B", 2, { total: 312.01 }),
      receipt("C", 3, { currency: "USD" }),
      receipt("D", 4, { vendor: "Harbour Lane Cafe" }),
    ]);
    expect(flags.size).toBe(0);
  });

  it("R-DUP-1: a missing field never counts as equal", () => {
    const flags = findDuplicates([
      receipt("A", 1, { total: null }),
      receipt("B", 2, { total: null }),
    ]);
    expect(flags.size).toBe(0);
  });

  it("R-DUP-1: flagged duplicates are excluded from totals, never deleted", () => {
    const flags = findDuplicates([
      receipt("A", 1, { fileHash: "x" }),
      receipt("B", 2, { fileHash: "x" }),
    ]);
    expect(flags.get("B")?.excludedFromTotals).toBe(true);
  });

  it("R-DUP-2: same vendor and amount on different dates is not a duplicate (monthly subscription)", () => {
    const flags = findDuplicates([
      receipt("R21", 1, {
        vendor: "Teamline Inc.",
        date: "2026-10-03",
        total: 12,
        currency: "USD",
      }),
      receipt("R22", 2, {
        vendor: "Teamline Inc.",
        date: "2026-10-17",
        total: 12,
        currency: "USD",
      }),
    ]);
    expect(flags.size).toBe(0);
  });

  it("normaliseVendor ignores case, accents, punctuation, and legal suffixes", () => {
    expect(normaliseVendor("Sample Café")).toBe(normaliseVendor("SAMPLE CAFE"));
    expect(normaliseVendor("Demo Cloud Pty Ltd")).toBe("demo cloud");
    expect(normaliseVendor("Nimbus Compute Inc.")).toBe("nimbus compute");
  });
});
