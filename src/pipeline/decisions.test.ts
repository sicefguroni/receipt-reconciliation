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

describe("R-MAT-10: one receipt paid in two payments (stress S06)", () => {
  // October with R01's $18.50 charged as $10.00 and $8.50, plus a refund line.
  const split = (decisions = [] as ReturnType<typeof decision>[]) =>
    reconcileMonth(
      {
        ...snapshot,
        statementLines: snapshot.statementLines.flatMap((l) =>
          l.id === "L03"
            ? [
                { ...l, id: "L03a", amountAud: 10 },
                { ...l, id: "L03b", amountAud: 8.5 },
                { ...l, id: "L03r", amountAud: -3 },
              ]
            : [l],
        ),
      },
      decisions,
      config,
    );
  const splitR01 = decision("R01", {
    action: "split_payment",
    after: { statementLineIds: ["L03a", "L03b"] },
  });
  const r01 = (m: ReturnType<typeof split>) => m.receipts.find((r) => r.id === "R01");

  it("neither part is matched automatically; the split pays the receipt at the sum", () => {
    expect(r01(split())?.state.status).not.toBe("matched");
    const m = split([splitR01]);
    expect(r01(m)?.state.status).toBe("matched");
    expect(r01(m)?.state.ledgerAmountAud).toBe(18.5);
    expect(m.noReceipt.map((n) => n.line.id)).not.toContain("L03a");
    expect(m.noReceipt.map((n) => n.line.id)).not.toContain("L03b");
    expect(m.totals.ledgerAud).toBe(month().totals.ledgerAud);
  });

  it("approval keeps the split", () => {
    const approve = decision("R01", {
      action: "approve",
      after: { statementLineId: "L03a", reimbursement: false },
    });
    const m = split([splitR01, approve]);
    expect(r01(m)?.outcome).toBe("approved");
    expect(r01(m)?.state.ledgerAmountAud).toBe(18.5);
    expect(r01(m)?.match?.extraLineIds).toEqual(["L03b"]);
  });

  it("a later claim on one of its lines undoes the whole split (R-MAT-4)", () => {
    const steal = decision("R15", { action: "choose_match", after: { statementLineId: "L03b" } });
    const m = split([splitR01, steal]);
    expect(r01(m)?.match?.extraLineIds ?? []).toEqual([]);
    expect(r01(m)?.state.status).not.toBe("matched");
  });

  it("is refused with a credit, or the same line twice", () => {
    const check = (ids: string[]) =>
      message(
        checkDecision(
          split(),
          {
            subjectId: "R01",
            change: { action: "split_payment", after: { statementLineIds: ids } },
          },
          REVIEWER,
          config,
        ),
      );
    expect(check(["L03a", "L03b"])).toBe("ok");
    expect(check(["L03a", "L03r"])).toMatch(/refund or credit/);
    expect(check(["L03a", "L03a"])).toBe("Choose each payment only once.");
  });
});

describe("Day 4 (C1): pairing a receipt with an unrelated payment", () => {
  // The builder's run paired R13 ($14.70 coffee, personal card) with L26 ($75.20 petrol, company
  // card) and signed it off as "Good".
  const chosen = decision("R13", { action: "choose_match", after: { statementLineId: "L26" } });

  it("the pairing lists what does not fit, in plain words", () => {
    const r13 = month([chosen]).receipts.find((r) => r.id === "R13");
    expect(r13?.concerns).toEqual([
      "It was not one of the suggested payments.",
      'The payment is "SAMPLE PETROL SAMPLE CITY", which does not look like Station Kiosk Cafe.',
      "It charged $75.20 for a $14.70 receipt (412% more).",
      "It is 4 days from the receipt date.",
      "The receipt says it was paid with a personal card, but this payment is on the company card.",
    ]);
  });

  it("'Good' is refused as a sign-off, with what to write instead", () => {
    const check = checkDecision(
      month([chosen]),
      {
        subjectId: "R13",
        change: { action: "sign_off_difference", after: { statementLineId: "L26" } },
        reason: "Good",
      },
      REVIEWER,
      config,
    );
    expect(message(check)).toBe(
      'Give a reason for the difference: at least 8 characters, for example "tip added at the table".',
    );
  });

  it("a substitute or 'not an expense' with 'Good' or 'Monthly' is refused too", () => {
    const line = (action: "record_substitute" | "mark_not_expense", reason: string) =>
      message(
        checkDecision(
          month(),
          {
            subjectId: "L44",
            change:
              action === "record_substitute"
                ? { action, after: { category: "Other" } }
                : { action, after: {} },
            reason,
          },
          REVIEWER,
          config,
        ),
      );
    expect(line("record_substitute", "Good")).toBe(
      "Give a reason for recording a substitute: at least 8 characters.",
    );
    expect(line("mark_not_expense", "Monthly")).toBe(
      "Give a reason for marking it not an expense: at least 8 characters.",
    );
    expect(line("mark_not_expense", "Monthly card fee")).toBe("ok");
  });

  it("a hotel paired with a taxi fare is called a different vendor, though both say 'Sample'", () => {
    const hotelWithTaxi = decision("R20", {
      action: "choose_match",
      after: { statementLineId: "L40" },
    });
    expect(month([hotelWithTaxi]).receipts.find((r) => r.id === "R20")?.concerns).toContain(
      'The payment is "METRO TAXI CO SAMPLE CITY", which does not look like Sample Harbour Hotel.',
    );
  });

  it("no automatic match in October carries a concern, so a warning means something", () => {
    const flagged = month()
      .receipts.filter((r) => r.state.status === "matched" && r.concerns.length > 0)
      .map((r) => `${r.id}: ${r.concerns.join(" ")}`);
    expect(flagged).toEqual([]);
  });
});

describe("R-MAT-11: a pairing that is clearly someone else's payment is refused (Day 4, P1)", () => {
  const ask = (subjectId: string, change: Parameters<typeof checkDecision>[1]["change"]) =>
    message(checkDecision(month(), { subjectId, change }, REVIEWER, config));
  const refusal =
    "L44 (MONTHLY CARD FEE, $10.00) does not look like this receipt's payment: a different vendor, 96% less, and not one of the suggested payments. Choose another payment, reimburse, or remove the receipt.";

  it("P1's pairing, R20 ($268 hotel) with L44 ($10 card fee), is refused with what to do", () => {
    expect(ask("R20", { action: "choose_match", after: { statementLineId: "L44" } })).toBe(refusal);
  });

  it("the same from the line's side, and inside a split", () => {
    expect(ask("L44", { action: "link_receipt", after: { receiptId: "R20" } })).toBe(refusal);
    expect(
      ask("R20", { action: "split_payment", after: { statementLineIds: ["L44", "L02"] } }),
    ).toMatch(/does not look like this receipt's payment/);
  });

  it("C1's pairing, R13 with the petrol charge, is refused too", () => {
    expect(ask("R13", { action: "choose_match", after: { statementLineId: "L26" } })).toContain(
      "L26 (SAMPLE PETROL SAMPLE CITY, $75.20) does not look like this receipt's payment",
    );
  });

  it("the key's own human choices still go through (TC04, TC11)", () => {
    expect(ask("R04", { action: "choose_match", after: { statementLineId: "L16" } })).toBe("ok");
    expect(ask("R15", { action: "choose_match", after: { statementLineId: "L22" } })).toBe("ok");
  });

  it("every wrong pairing from both cold runs is refused (C1: 3, P1: 1)", () => {
    // R15 and R20's lines share "SAMPLE" with the vendor, which used to count as alike.
    const pairs: [string, string][] = [
      ["R13", "L26"], // C1: coffee with the petrol charge
      ["R15", "L32"], // C1: app with the bookshop charge
      ["R20", "L40"], // C1: hotel with a taxi fare
      ["R20", "L44"], // P1: hotel with the card fee
    ];
    for (const [receiptId, lineId] of pairs) {
      expect(
        ask(receiptId, { action: "choose_match", after: { statementLineId: lineId } }),
        `${receiptId} with ${lineId}`,
      ).toMatch(/does not look like this receipt's payment/);
    }
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
