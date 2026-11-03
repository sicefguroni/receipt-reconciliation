import { beforeAll, describe, expect, it } from "vitest";
import { checkDecision, type DecisionCheck } from "./decisions";
import type { MonthSnapshot } from "./read-month";
import { reconcileMonth } from "./reconcile";
import { testConfig as config, decision, oracleSnapshot, REVIEWER } from "./test-month";

// The decision boundary: what a person may do to the month as it stands, and the messages
// they see when they may not.

let snapshot: MonthSnapshot;
beforeAll(async () => {
  snapshot = await oracleSnapshot();
});

const month = (decisions = [] as ReturnType<typeof decision>[]) =>
  reconcileMonth(snapshot, decisions, config);
const message = (check: DecisionCheck) => (check.ok ? "ok" : check.message);

describe("R-MAT-8: a refund on the statement", () => {
  // October with a refund of R01's café purchase added (Day 4 stress cases S07, S08).
  const withRefund = (decisions = [] as ReturnType<typeof decision>[]) =>
    reconcileMonth(
      {
        ...snapshot,
        statementLines: [
          ...snapshot.statementLines,
          {
            id: "L99",
            date: "2026-10-04",
            description: "SQ *SAMPLE CAFE SAMPLE CITY AU",
            amountAud: -18.5,
            account: "company_card",
          },
        ],
      },
      decisions,
      config,
    );
  const refused =
    "Statement line L99 is a refund or credit, so it cannot be a receipt's payment. Record it against a category, or mark it not an expense.";

  it("is never a candidate or a choosable line, and the purchase still matches", () => {
    const m = withRefund();
    expect(m.receipts.find((r) => r.id === "R01")?.match?.statementLineId).toBe("L03");
    expect(
      m.receipts.flatMap((r) => r.match?.candidates ?? []).map((c) => c.statementLineId),
    ).not.toContain("L99");
    expect(m.freeLines.map((l) => l.id)).not.toContain("L99");
    expect(m.noReceipt.map((n) => n.line.id)).toContain("L99");
  });

  it("choosing it for a receipt, or linking a receipt to it, is refused with what to do", () => {
    const choose = {
      subjectId: "R15",
      change: { action: "choose_match" as const, after: { statementLineId: "L99" } },
    };
    const link = {
      subjectId: "L99",
      change: { action: "link_receipt" as const, after: { receiptId: "R15" } },
    };
    expect(message(checkDecision(withRefund(), choose, REVIEWER, config))).toBe(refused);
    expect(message(checkDecision(withRefund(), link, REVIEWER, config))).toBe(refused);
  });

  it("recorded against a category, it reduces the ledger by the refund", () => {
    const before = withRefund().totals.ledgerAud;
    const after = withRefund([
      decision(
        "L99",
        { action: "record_substitute", after: { category: "Meals & Entertainment" } },
        "Coffee refunded",
      ),
    ]).totals.ledgerAud;
    expect(Math.round((after - before) * 100)).toBe(-1850);
  });
});

describe("decision checks", () => {
  it("R-APR-1: a submitter's own approval is refused with the reason", () => {
    const r = month().receipts.find((x) => x.id === "R01");
    const check = checkDecision(
      month(),
      {
        subjectId: "R01",
        change: { action: "approve", after: { statementLineId: null, reimbursement: false } },
      },
      r?.submitterId ?? "",
      config,
    );
    expect(message(check)).toBe("You submitted this receipt, so someone else must approve it.");
  });

  it("approve records the match the item has now, whatever the request claimed", () => {
    const check = checkDecision(
      month(),
      {
        subjectId: "R01",
        change: { action: "approve", after: { statementLineId: "L99", reimbursement: true } },
      },
      REVIEWER,
      config,
    );
    expect(check.ok && check.decision.action === "approve" && check.decision.after).toEqual({
      statementLineId: "L03",
      reimbursement: false,
    });
  });

  it("an approved receipt is locked", () => {
    const approved = month([
      decision("R01", {
        action: "approve",
        after: { statementLineId: "L03", reimbursement: false },
      }),
    ]);
    const check = checkDecision(
      approved,
      {
        subjectId: "R01",
        change: { action: "correct_field", after: { field: "vendor", value: "X" } },
      },
      REVIEWER,
      config,
    );
    expect(message(check)).toBe("Receipt R01 is already approved.");
  });

  it("R-AMT-4: sign-off without a 3-character reason is refused", () => {
    const m = month([
      decision("R04", { action: "choose_match", after: { statementLineId: "L16" } }),
    ]);
    const ask = (reason: string) =>
      checkDecision(
        m,
        {
          subjectId: "R04",
          change: { action: "sign_off_difference", after: { statementLineId: "L16" } },
          reason,
        },
        REVIEWER,
        config,
      );
    expect(message(ask("ok"))).toMatch(/^Give a reason for the difference/);
    expect(ask("Extra hinge part").ok).toBe(true);
  });

  it("R-MAT-7: substitute and not-an-expense need a reason; a substitute needs a real category", () => {
    const m = month();
    const ask = (change: unknown, reason?: string) =>
      message(checkDecision(m, { subjectId: "L02", change, reason }, REVIEWER, config));
    expect(ask({ action: "mark_not_expense", after: {} })).toMatch(/^Give a reason/);
    expect(ask({ action: "record_substitute", after: { category: "Other" } })).toMatch(
      /^Give a reason .* substitute/,
    );
    expect(
      ask({ action: "record_substitute", after: { category: "Snacks" } }, "Lost receipt"),
    ).toBe("Choose a category for the substitute.");
    expect(ask({ action: "record_substitute", after: { category: "Other" } }, "Lost receipt")).toBe(
      "ok",
    );
  });

  it("a line held by an approved receipt cannot be chosen for another", () => {
    const m = month([
      decision("R01", {
        action: "approve",
        after: { statementLineId: "L03", reimbursement: false },
      }),
    ]);
    const check = checkDecision(
      m,
      { subjectId: "R15", change: { action: "choose_match", after: { statementLineId: "L03" } } },
      REVIEWER,
      config,
    );
    expect(message(check)).toBe(
      "Statement line L03 belongs to receipt R01, which is already approved.",
    );
  });

  it("reimbursing a company-card receipt with no statement line needs a reason", () => {
    const check = checkDecision(
      month(),
      { subjectId: "R20", change: { action: "choose_match", after: { statementLineId: null } } },
      REVIEWER,
      config,
    );
    expect(message(check)).toMatch(/^Give a reason .* reimbursing/);
  });

  it("corrections are checked and normalised, and the old value is kept as `before`", () => {
    const ask = (field: string, value: string) =>
      checkDecision(
        month(),
        { subjectId: "R01", change: { action: "correct_field", after: { field, value } } },
        REVIEWER,
        config,
      );
    expect(message(ask("date", "02/10/2026"))).toBe(
      "Enter the date as YYYY-MM-DD, for example 2026-10-02.",
    );
    expect(message(ask("category", "Snacks"))).toBe("Choose a category from the list.");
    const total = ask("total", "$1,018.5");
    expect(total.ok && total.decision).toMatchObject({
      after: { value: "1018.50" },
      before: { value: 18.5 },
    });
    const currency = ask("currency", "usd");
    expect(currency.ok && currency.decision).toMatchObject({ after: { value: "USD" } });
  });

  it("a malformed request is refused without detail", () => {
    expect(
      message(
        checkDecision(
          month(),
          { subjectId: "R01", change: { action: "delete" } },
          REVIEWER,
          config,
        ),
      ),
    ).toBe("That action was not understood. Reload the page and try again.");
  });
});
