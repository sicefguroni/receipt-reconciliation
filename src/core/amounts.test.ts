import { describe, expect, it } from "vitest";
import { type AmountPolicy, compareAmounts, isValidSignOffReason } from "./amounts";

const policy: AmountPolicy = { pctThreshold: 10, audThreshold: 100 };
const aud = (total: number) => ({ total, currency: "AUD" });

describe("R-AMT amount-difference rules", () => {
  it("R-AMT-1: the difference is the AUD gap between ledger amount and receipt", () => {
    const c = compareAmounts(aud(42), { amountAud: 44 }, policy);
    expect(c).toMatchObject({ comparedIn: "AUD", difference: 2, differenceAud: 2 });
  });

  it("R-AMT-1: equal amounts have no difference", () => {
    expect(compareAmounts(aud(18.5), { amountAud: 18.5 }, policy)?.kind).toBe("none");
  });

  it("R-AMT-2: over 10% flags over_threshold (TC04: $500 receipt, $560 charged)", () => {
    expect(compareAmounts(aud(500), { amountAud: 560 }, policy)?.kind).toBe("over_threshold");
  });

  it("R-AMT-2: over $100 flags even when under 10% (the OR reading, confirmed 2026-11-02)", () => {
    // $1,500 receipt charged $1,620: 8%, but $120.
    expect(compareAmounts(aud(1500), { amountAud: 1620 }, policy)?.kind).toBe("over_threshold");
  });

  it("R-AMT-2: exactly 10% or exactly $100 is not 'over'", () => {
    expect(compareAmounts(aud(500), { amountAud: 550 }, policy)?.kind).toBe("small");
    expect(compareAmounts(aud(2000), { amountAud: 2100 }, policy)?.kind).toBe("small");
  });

  it("R-AMT-2: a charge lower than the receipt is a difference too", () => {
    expect(compareAmounts(aud(500), { amountAud: 440 }, policy)).toMatchObject({
      difference: -60,
      differenceAud: 60,
      kind: "over_threshold",
    });
  });

  it("R-AMT-2: thresholds come from the policy, not the code", () => {
    const strict: AmountPolicy = { pctThreshold: 2, audThreshold: 100 };
    expect(compareAmounts(aud(42), { amountAud: 44 }, strict)?.kind).toBe("over_threshold");
  });

  it("R-AMT-3: a tip within threshold is 'small': a normal match with a +$2.00 badge (TC05)", () => {
    expect(compareAmounts(aud(42), { amountAud: 44 }, policy)).toMatchObject({
      kind: "small",
      difference: 2,
    });
  });

  it("R-AMT-3: one cent or less is no difference; more than one cent is 'small'", () => {
    expect(compareAmounts(aud(10), { amountAud: 10.01 }, policy)?.kind).toBe("none");
    expect(compareAmounts(aud(10), { amountAud: 10.02 }, policy)?.kind).toBe("small");
  });

  it("R-AMT-3: floating-point noise is not a difference", () => {
    // 0.1 + 0.2 !== 0.3 in floating point; cents make it exact.
    expect(compareAmounts(aud(0.1 + 0.2), { amountAud: 0.3 }, policy)?.kind).toBe("none");
  });

  it("R-CUR-4: a foreign purchase compares on the original amount, so the FX fee is not a difference (TC02)", () => {
    const c = compareAmounts(
      { total: 49, currency: "USD", totalAud: 74.5 },
      { amountAud: 77.12, originalAmount: { amount: 49, currency: "USD" } },
      policy,
    );
    expect(c).toMatchObject({ comparedIn: "USD", difference: 0, kind: "none" });
  });

  it("R-CUR-4: a real foreign difference is converted to AUD at the bank's implied rate", () => {
    // USD 100 receipt, USD 115 charged as AUD 172.50 (1.5 AUD per USD): 15% and AUD 22.50.
    const c = compareAmounts(
      { total: 100, currency: "USD" },
      { amountAud: 172.5, originalAmount: { amount: 115, currency: "USD" } },
      policy,
    );
    expect(c).toMatchObject({ comparedIn: "USD", difference: 15, differenceAud: 22.5 });
    expect(c?.kind).toBe("over_threshold");
  });

  it("R-CUR-4: without the original amount, a foreign receipt compares in AUD after conversion", () => {
    const c = compareAmounts(
      { total: 49, currency: "USD", totalAud: 75.46 },
      { amountAud: 77.12 },
      policy,
    );
    expect(c).toMatchObject({ comparedIn: "AUD", difference: 1.66, kind: "small" });
  });

  it("R-CUR-3 with R-AMT: a foreign receipt with no AUD value cannot be compared", () => {
    expect(
      compareAmounts({ total: 49, currency: "USD", totalAud: null }, { amountAud: 77.12 }, policy),
    ).toBeNull();
  });

  it("R-AMT-4: signing off needs a specific reason (Day 4, C1: every sign-off said 'Good')", () => {
    expect(isValidSignOffReason("Tip added at the terminal")).toBe(true);
    expect(isValidSignOffReason("Bank fee")).toBe(true); // exactly 8 characters
    expect(isValidSignOffReason("Good")).toBe(false);
    expect(isValidSignOffReason("Looks good, ok")).toBe(false); // long, but only generic words
    expect(isValidSignOffReason("Monthly")).toBe(false);
    expect(isValidSignOffReason("ok!")).toBe(false);
    expect(isValidSignOffReason("   ")).toBe(false);
    expect(isValidSignOffReason(null)).toBe(false);
  });
});
