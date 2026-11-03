import { describe, expect, it } from "vitest";
import { orderQueue, type QueueItem, queueGroup } from "./queue";
import type { ExceptionCode } from "./schemas";

const item = (
  id: string,
  exceptions: ExceptionCode[] = [],
  overrides: Partial<Extract<QueueItem, { kind: "receipt" }>> = {},
): QueueItem => ({
  kind: "receipt",
  id,
  status: "matched",
  exceptions,
  reimbursement: false,
  amountAud: 10,
  ...overrides,
});

describe("R-QUE review queue order", () => {
  it("R-QUE: group 1 is blocking intake problems", () => {
    expect(queueGroup(item("a", ["UNREADABLE"]))).toBe(1);
    expect(queueGroup(item("b", ["NOT_A_RECEIPT"]))).toBe(1);
    expect(queueGroup(item("c", ["DUPLICATE"], { status: "unmatched" }))).toBe(1);
  });

  it("R-QUE: group 2 is amount differences over the threshold", () => {
    expect(
      queueGroup(item("a", ["AMOUNT_DIFFERS_OVER_THRESHOLD"], { status: "amount_differs" })),
    ).toBe(2);
  });

  it("R-QUE: group 3 is missing information", () => {
    for (const code of [
      "MISSING_PURPOSE",
      "LOW_CONFIDENCE_FIELD",
      "UNKNOWN_CATEGORY",
      "FX_RATE_UNAVAILABLE",
    ] as const) {
      expect(queueGroup(item("a", [code]))).toBe(3);
    }
  });

  it("R-QUE: group 4 is match decisions, reimbursements, and lines with no receipt", () => {
    expect(queueGroup(item("a", ["AMBIGUOUS_MATCH"], { status: "ambiguous" }))).toBe(4);
    expect(queueGroup(item("b", ["NO_PAYMENT_FOUND"], { status: "unmatched" }))).toBe(4);
    expect(queueGroup(item("c", [], { status: "unmatched", reimbursement: true }))).toBe(4);
    expect(queueGroup({ kind: "no_receipt_line", id: "L02", amountAud: 12.4 })).toBe(4);
  });

  it("R-QUE: group 5 is matches ready to approve, including small-difference badges", () => {
    expect(queueGroup(item("a"))).toBe(5);
  });

  it("R-QUE: an item with several flags goes to its earliest group", () => {
    expect(queueGroup(item("a", ["MISSING_PURPOSE", "DUPLICATE"]))).toBe(1);
  });

  it("R-QUE: groups come in order 1 to 5, largest AUD amount first within a group", () => {
    const sections = orderQueue([
      item("small", [], { amountAud: 5 }),
      item("dup", ["DUPLICATE"]),
      item("big", [], { amountAud: 500 }),
      item("unknown", [], { amountAud: null }),
    ]);
    expect(sections.map((s) => s.group)).toEqual([1, 2, 3, 4, 5]);
    expect(sections[0]?.items.map((i) => i.id)).toEqual(["dup"]);
    expect(sections[4]?.items.map((i) => i.id)).toEqual(["big", "small", "unknown"]);
  });

  it("R-QUE: every list shows a total for the rows shown (E9)", () => {
    const sections = orderQueue([
      item("a", [], { amountAud: 0.1 }),
      item("b", [], { amountAud: 0.2 }),
      item("c", [], { amountAud: null }),
    ]);
    expect(sections[4]?.totalAud).toBe(0.3); // cents, so not 0.30000000000000004
    expect(sections[0]?.totalAud).toBe(0);
  });
});
