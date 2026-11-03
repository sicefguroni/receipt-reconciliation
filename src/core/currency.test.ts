import { describe, expect, it } from "vitest";
import { checkCurrency, convertToAud, type FxRate, pickRate, summariseExcluded } from "./currency";

const ECB = "ECB via Frankfurter";
const rates: FxRate[] = [
  { currency: "USD", date: "2026-10-01", audPerUnit: 1.5, source: ECB },
  { currency: "USD", date: "2026-10-02", audPerUnit: 1.52, source: ECB }, // Friday
  { currency: "USD", date: "2026-10-05", audPerUnit: 1.54, source: ECB }, // Monday
  { currency: "EUR", date: "2026-10-02", audPerUnit: 1.65, source: ECB },
];

describe("R-CUR currency rules", () => {
  it("R-CUR-1: AUD receipts never enter FX conversion", () => {
    // Even with no rates at all, AUD is counted at face value.
    expect(convertToAud(89, "AUD", "2026-10-06", [])).toEqual({ status: "base", amountAud: 89 });
  });

  it("R-CUR-1: an AUD receipt from a foreign-sounding vendor stays AUD (E2 regression)", () => {
    const result = convertToAud(89, "AUD", "2026-10-06", rates);
    expect(result.status).toBe("base");
    expect(result.status === "base" && result.amountAud).toBe(89);
  });

  it("R-CUR-2: converts at the rate for the receipt date and records rate, date, and source", () => {
    expect(convertToAud(49, "USD", "2026-10-05", rates)).toEqual({
      status: "converted",
      amountAud: 75.46,
      rate: 1.54,
      rateDate: "2026-10-05",
      source: ECB,
    });
  });

  it("R-CUR-2: a weekend receipt uses the most recent earlier business day", () => {
    // Saturday 3 and Sunday 4 October have no ECB rate; use Friday 2 October.
    expect(pickRate(rates, "USD", "2026-10-04")?.date).toBe("2026-10-02");
    expect(pickRate(rates, "USD", "2026-10-03")?.audPerUnit).toBe(1.52);
  });

  it("R-CUR-2: never uses a rate from after the receipt date", () => {
    expect(pickRate(rates, "USD", "2026-09-30")).toBeNull();
  });

  it("R-CUR-2: a rate older than the lookback window is not used", () => {
    expect(pickRate(rates, "USD", "2026-10-20")).toBeNull();
    expect(pickRate(rates, "USD", "2026-10-20", 30)?.date).toBe("2026-10-05");
  });

  it("R-CUR-3: no rate flags FX_RATE_UNAVAILABLE and excludes the amount (never a rate of 1)", () => {
    expect(convertToAud(15, "GBP", "2026-10-05", rates)).toEqual({
      status: "unavailable",
      exception: "FX_RATE_UNAVAILABLE",
      excluded: { amount: 15, currency: "GBP" },
    });
  });

  it("R-CUR-3: the summary shows excluded amounts per currency, not just a count", () => {
    const summary = summariseExcluded([
      convertToAud(15.1, "GBP", "2026-10-05", []),
      convertToAud(20.2, "GBP", "2026-10-06", []),
      convertToAud(30, "JPY", "2026-10-06", []),
      convertToAud(10, "AUD", "2026-10-06", []),
    ]);
    expect(summary).toEqual([
      { currency: "GBP", amount: 35.3, count: 2 },
      { currency: "JPY", amount: 30, count: 1 },
    ]);
  });

  it("R-CUR-5: a confident currency passes without a flag", () => {
    expect(checkCurrency({ value: "usd", confidence: 0.95 }, 0.8)).toEqual({
      currency: "USD",
      exceptions: [],
    });
  });

  it("R-CUR-5: a low-confidence currency (bare '$') flags LOW_CONFIDENCE_FIELD", () => {
    expect(checkCurrency({ value: "AUD", confidence: 0.55 }, 0.8).exceptions).toEqual([
      "LOW_CONFIDENCE_FIELD",
    ]);
  });

  it("R-CUR-5: a missing or invalid currency is never silently assumed to be AUD", () => {
    expect(checkCurrency({ value: null, confidence: 0.9 }, 0.8)).toEqual({
      currency: null,
      exceptions: ["LOW_CONFIDENCE_FIELD"],
    });
    expect(checkCurrency({ value: "$", confidence: 0.9 }, 0.8).currency).toBeNull();
  });
});
