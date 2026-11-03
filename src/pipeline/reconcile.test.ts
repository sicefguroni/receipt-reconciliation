import { beforeAll, describe, expect, it } from "vitest";
import { checkApproval } from "@/core/approvals";
import { queueGroup } from "@/core/queue";
import type { Decision } from "@/core/schemas";
import { exceptionsCsv, ledgerCsv, packSummary } from "./pack";
import type { MonthSnapshot } from "./read-month";
import { type MonthResult, type ReceiptResult, reconcileMonth } from "./reconcile";
import { testConfig as config, decision, oracleSnapshot, REVIEWER, truth } from "./test-month";

// Human decisions on the October month (perfect extraction), checked against the hand-written
// ground truth: each review action, and a whole month closed by a simulated reviewer.

let snapshot: MonthSnapshot;
beforeAll(async () => {
  snapshot = await oracleSnapshot();
});

const month = (decisions: Decision[] = []) => reconcileMonth(snapshot, decisions, config);
const receipt = (m: MonthResult, id: string): ReceiptResult => {
  const r = m.receipts.find((x) => x.id === id);
  if (!r) throw new Error(`no receipt ${id}`);
  return r;
};
const group = (r: ReceiptResult) =>
  queueGroup({
    kind: "receipt",
    id: r.id,
    status: r.state.status,
    exceptions: r.openExceptions,
    reimbursement: r.state.reimbursement,
    amountAud: null,
  });
const subject = (r: ReceiptResult) => ({
  submitterId: r.submitterId,
  status: r.state.status,
  exceptions: r.openExceptions,
  category: r.category ? r.category.category : undefined,
});
const approve = (r: ReceiptResult) =>
  decision(r.id, {
    action: "approve",
    after: {
      statementLineId: r.match?.statementLineId ?? null,
      reimbursement: r.state.reimbursement,
    },
  });

describe("review decisions", () => {
  it("TC04: choosing the over-threshold line fires the flag; sign-off with a reason unblocks approval", () => {
    const chose = [decision("R04", { action: "choose_match", after: { statementLineId: "L16" } })];
    const r = receipt(month(chose), "R04");
    expect(r.state.status).toBe("amount_differs");
    expect(r.openExceptions).toEqual(["AMOUNT_DIFFERS_OVER_THRESHOLD"]);
    expect(r.state.ledgerAmountAud).toBe(560);
    expect(group(r)).toBe(2);
    expect(checkApproval(subject(r), REVIEWER).allowed).toBe(false);

    const signed = [
      ...chose,
      decision(
        "R04",
        { action: "sign_off_difference", after: { statementLineId: "L16" } },
        "Extra hinge part",
      ),
    ];
    const after = receipt(month(signed), "R04");
    expect(after.openExceptions).toEqual([]);
    expect(after.state.exceptions).toContain("AMOUNT_DIFFERS_OVER_THRESHOLD"); // still on record
    expect(after.signOff?.reason).toBe("Extra hinge part");
    expect(group(after)).toBe(5);
  });

  it("R-AMT-4: a sign-off holds only for the line it was given against", () => {
    const m = month([
      decision("R04", { action: "choose_match", after: { statementLineId: "L16" } }),
      decision(
        "R04",
        { action: "sign_off_difference", after: { statementLineId: "L99" } },
        "Wrong line",
      ),
    ]);
    expect(receipt(m, "R04").openExceptions).toEqual(["AMOUNT_DIFFERS_OVER_THRESHOLD"]);
  });

  it("TC11: choosing one of two ambiguous lines matches it; the twin stays a line with no receipt", () => {
    const m = month([
      decision("R15", { action: "choose_match", after: { statementLineId: "L22" } }),
    ]);
    const r = receipt(m, "R15");
    expect([r.state.status, r.match?.statementLineId, r.openExceptions]).toEqual([
      "matched",
      "L22",
      [],
    ]);
    const listed = m.noReceiptLines.map((l) => l.id);
    expect(listed).toContain("L24");
    expect(listed).not.toContain("L22");
  });

  it("R-MAT-4: choosing a line another receipt had auto-matched sends that receipt back to matching", () => {
    expect(receipt(month(), "R01").match?.statementLineId).toBe("L03");
    const m = month([
      decision("R05", { action: "choose_match", after: { statementLineId: "L03" } }),
    ]);
    expect(receipt(m, "R05").match?.statementLineId).toBe("L03");
    expect(receipt(m, "R01").match?.statementLineId).not.toBe("L03");
  });

  it("R-MAT-4: when two choices claim the same line, the later one wins", () => {
    const m = month([
      decision("R05", { action: "choose_match", after: { statementLineId: "L03" } }),
      decision("R01", { action: "choose_match", after: { statementLineId: "L03" } }),
    ]);
    expect(receipt(m, "R01").match?.statementLineId).toBe("L03");
    expect(receipt(m, "R05").match?.statementLineId).not.toBe("L03"); // back to automatic
  });

  it("R-REQ-1: adding a purpose clears MISSING_PURPOSE, and the exceptions log says how", () => {
    const m = month([
      decision("R06", {
        action: "correct_field",
        after: { field: "businessPurpose", value: "Team lunch" },
      }),
    ]);
    const r = receipt(m, "R06");
    expect(r.openExceptions).toEqual([]);
    expect(r.businessPurpose).toBe("Team lunch");
    expect(m.exceptionLog).toContainEqual(
      expect.objectContaining({
        itemId: "R06",
        code: "MISSING_PURPOSE",
        open: false,
        resolution: "purpose added",
      }),
    );
    // A placeholder is still missing.
    const placeholder = month([
      decision("R06", {
        action: "correct_field",
        after: { field: "businessPurpose", value: "n/a" },
      }),
    ]);
    expect(receipt(placeholder, "R06").openExceptions).toEqual(["MISSING_PURPOSE"]);
  });

  it("R-DUP-1: confirming a duplicate keeps it on record and out of totals; 'not a duplicate' includes it", () => {
    const confirmed = month([
      decision("R09", { action: "resolve_duplicate", after: { duplicate: true } }),
    ]);
    const r = receipt(confirmed, "R09");
    expect([r.outcome, r.state.excludedFromTotals]).toEqual(["duplicate_confirmed", true]);
    expect(confirmed.done.map((i) => i.id)).toContain("R09");

    const cleared = month([
      decision("R10", { action: "resolve_duplicate", after: { duplicate: false } }, "Second visit"),
    ]);
    const r10 = receipt(cleared, "R10");
    expect(r10.state.exceptions).not.toContain("DUPLICATE");
    expect(r10.outcome).toBe("open");
  });

  it("a corrected field gets full confidence and drops its low-confidence flag", () => {
    const base = receipt(month(), "R01");
    expect(base.extraction?.vendor.value).toBe("Sample Café");
    const m = month([
      decision("R01", {
        action: "correct_field",
        after: { field: "vendor", value: "Sample Cafe Two" },
      }),
    ]);
    expect(receipt(m, "R01").extraction?.vendor).toEqual({
      value: "Sample Cafe Two",
      confidence: 1,
    });
    expect(receipt(m, "R01").corrected).toEqual(["vendor"]);
  });

  it("R-CAT-3: a person can choose Other; the source becomes human", () => {
    const m = month([
      decision("R01", { action: "correct_field", after: { field: "category", value: "Other" } }),
    ]);
    expect(receipt(m, "R01").category).toMatchObject({ category: "Other", source: "human" });
  });

  it("TC10: an approved reimbursement is done and counts the receipt amount", () => {
    const r = receipt(month(), "R13");
    expect(r.state.reimbursement).toBe(true);
    const m = month([approve(r)]);
    const done = receipt(m, "R13");
    expect([done.outcome, done.state.ledgerAmountAud]).toEqual(["approved", 14.7]);
    expect(m.totals.approvedAud).toBe(14.7);
  });

  it("R-MAT-7: substitute, not-an-expense, and link each resolve a line with no receipt", () => {
    const m = month([
      decision(
        "L02",
        { action: "record_substitute", after: { category: "Other" } },
        "Pharmacy receipt lost",
      ),
      decision("L44", { action: "mark_not_expense", after: {} }, "Bank fee"),
      decision("L22", { action: "link_receipt", after: { receiptId: "R15" } }),
    ]);
    const byId = new Map(m.noReceipt.map((n) => [n.line.id, n]));
    expect(byId.get("L02")?.resolution).toMatchObject({ kind: "substitute", category: "Other" });
    expect(byId.get("L44")?.resolution).toMatchObject({ kind: "not_expense" });
    expect(byId.has("L22")).toBe(false); // now matched to R15
    expect(receipt(m, "R15").match?.statementLineId).toBe("L22");
    expect(m.totals.ledgerAud).toBe(month().totals.ledgerAud + 12.4 + 19.99);
    expect(m.freeLines.map((l) => l.id)).not.toContain("L02");
  });

  it("a removed receipt (re-upload requested) leaves the queue and the totals", () => {
    const m = month([decision("R20", { action: "request_reupload", after: {} })]);
    const r = receipt(m, "R20");
    expect([r.outcome, r.openExceptions, r.state.excludedFromTotals]).toEqual([
      "removed",
      [],
      true,
    ]);
    expect(m.queue.flatMap((s) => s.items).map((i) => i.id)).not.toContain("R20");
  });

  it("a line with no receipt that is an open receipt's candidate says so (TC04: L16 for R04)", () => {
    const m = month();
    expect(m.noReceipt.find((n) => n.line.id === "L16")?.candidateFor).toEqual(["R04"]);
    expect(m.noReceipt.find((n) => n.line.id === "L02")?.candidateFor).toEqual([]);
  });

  it("with no decisions, the result is what the pipeline found (what `pnpm eval` scores)", () => {
    const m = month();
    expect(m.decisionCount).toBe(0);
    expect(m.done).toEqual([]);
    expect(m.closed).toBe(false);
    expect(m.exceptionLog.every((row) => row.open)).toBe(true);
  });
});

/**
 * A reviewer who knows the ground truth works the queue top to bottom, one decision at a time,
 * re-deriving the month after each, until nothing is left. Proves every queue item has an action.
 */
function closeMonth(): { m: MonthResult; decisions: Decision[] } {
  const truthById = new Map(truth.receipts.map((t) => [t.id, t]));
  const decisions: Decision[] = [];
  const seen = new Map<string, number>();
  for (let step = 0; step < 300; step++) {
    const m = month(decisions);
    const item = m.queue.flatMap((s) => s.items)[0];
    if (!item) return { m, decisions };
    const visits = (seen.get(item.id) ?? 0) + 1;
    seen.set(item.id, visits);
    if (visits > 4) {
      const r = item.kind === "receipt" ? receipt(m, item.id) : null;
      throw new Error(
        `stuck on ${item.id}: ${JSON.stringify({ status: r?.state.status, open: r?.openExceptions, outcome: r?.outcome, last: decisions.at(-1) })}`,
      );
    }
    if (item.kind === "no_receipt_line") {
      const owner = truth.statementLines.find((l) => l.id === item.id)?.receiptId;
      decisions.push(
        owner
          ? decision(item.id, { action: "link_receipt", after: { receiptId: owner } })
          : decision(item.id, { action: "mark_not_expense", after: {} }, "Not a business expense"),
      );
      continue;
    }
    const r = receipt(m, item.id);
    const t = truthById.get(item.id);
    if (!t) throw new Error(`no truth for ${item.id}`);
    const open = r.openExceptions;
    if (open.includes("DUPLICATE")) {
      decisions.push(decision(r.id, { action: "resolve_duplicate", after: { duplicate: true } }));
    } else if (open.includes("MISSING_PURPOSE")) {
      decisions.push(
        decision(r.id, {
          action: "correct_field",
          after: { field: "businessPurpose", value: "Client work" },
        }),
      );
    } else if (open.includes("AMBIGUOUS_MATCH") || open.includes("NO_PAYMENT_FOUND")) {
      const lineId = t.statementLineId;
      if (lineId === null && !t.reimbursement) {
        decisions.push(
          decision(r.id, { action: "request_reupload", after: {} }, "Payment not found"),
        );
      } else {
        decisions.push(
          decision(r.id, { action: "choose_match", after: { statementLineId: lineId } }),
        );
      }
    } else if (open.includes("AMOUNT_DIFFERS_OVER_THRESHOLD")) {
      const lineId = r.match?.statementLineId ?? "";
      decisions.push(
        decision(
          r.id,
          { action: "sign_off_difference", after: { statementLineId: lineId } },
          "Confirmed with supplier",
        ),
      );
    } else {
      expect(checkApproval(subject(r), REVIEWER)).toEqual({ allowed: true });
      decisions.push(approve(r));
    }
  }
  throw new Error("the month did not close in 300 decisions");
}

describe("closing the October month", () => {
  it("every item can be resolved; the closed ledger equals the ground truth", () => {
    const { m, decisions } = closeMonth();
    expect(m.closed).toBe(true);
    expect(m.exceptionLog.filter((row) => row.open)).toEqual([]);
    // Ground truth, with R20 (no payment found, removed by the reviewer) out of the ledger.
    const expectedCents = truth.receipts.reduce(
      (sum, t) => sum + (t.excludedFromTotals ? 0 : Math.round((t.ledgerAmountAud ?? 0) * 100)),
      0,
    );
    expect(Math.round(m.totals.ledgerAud * 100)).toBe(expectedCents);
    expect(m.totals.approvedAud).toBe(m.totals.ledgerAud);
    for (const t of truth.receipts) {
      const r = receipt(m, t.id);
      if (t.duplicateOf) expect(r.outcome).toBe("duplicate_confirmed");
      else if (t.statementLineId) expect(r.match?.statementLineId).toBe(t.statementLineId);
    }
    expect(decisions.length).toBeGreaterThan(40);
  });

  it("the month-end pack adds up: category and payment-source totals equal the ledger", () => {
    const { m } = closeMonth();
    const s = packSummary(m);
    const cents = (rows: { amountAud: number }[]) =>
      rows.reduce((sum, r) => sum + Math.round(r.amountAud * 100), 0);
    expect(cents(s.byCategory)).toBe(Math.round(s.ledgerAud * 100));
    expect(cents(s.bySource)).toBe(Math.round(s.ledgerAud * 100));
    expect(s.byCategory.map((c) => c.label)).not.toContain("Uncategorised");
    // R-MAT-7: every statement line with no receipt is listed in the pack with how it was resolved.
    expect(s.noReceipt.every((n) => n.resolution !== null)).toBe(true);
    const log = exceptionsCsv(m).split("\r\n");
    expect(log[0]).toBe("item_id,item_type,flag,status,resolution,by,at,reason");
    expect(log.some((l) => l.includes(",open,"))).toBe(false);
    expect(ledgerCsv(m).split("\r\n").filter(Boolean)).toHaveLength(m.receipts.length + 1);
  });
});
