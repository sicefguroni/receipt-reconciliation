import { fromCents, normaliseCurrency, toCents } from "./money";
import { BASE_CURRENCY, type ExceptionCode } from "./schemas";

// Currency rules R-CUR-1 to R-CUR-5 (docs/sprint/05-business-rules.md).

/** One reference rate: 1 unit of `currency` = `audPerUnit` AUD on `date`. */
export interface FxRate {
  currency: string;
  date: string; // ISO date the rate applies to
  audPerUnit: number;
  source: string; // e.g. "ECB via Frankfurter"
}

export type Conversion =
  | { status: "base"; amountAud: number } // R-CUR-1
  | {
      status: "converted"; // R-CUR-2
      amountAud: number;
      rate: number;
      rateDate: string;
      source: string;
    }
  | {
      status: "unavailable"; // R-CUR-3
      exception: "FX_RATE_UNAVAILABLE";
      excluded: { amount: number; currency: string };
    };

function daysBetween(earlier: string, later: string): number {
  return (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000;
}

/**
 * R-CUR-2: the rate for the receipt date, or the most recent earlier business day
 * (ECB publishes no weekend or holiday rates). `maxLookbackDays` stops a stale rate
 * being used after a long gap; beyond it the rate is unavailable (R-CUR-3).
 */
export function pickRate(
  rates: readonly FxRate[],
  currency: string,
  date: string,
  maxLookbackDays = 7,
): FxRate | null {
  let best: FxRate | null = null;
  for (const r of rates) {
    if (r.currency !== currency || r.date > date) continue;
    if (daysBetween(r.date, date) > maxLookbackDays) continue;
    if (!best || r.date > best.date) best = r;
  }
  return best;
}

/**
 * R-CUR-1: AUD never enters FX conversion and is always counted.
 * R-CUR-2: other currencies convert at the picked reference rate.
 * R-CUR-3: no rate means FX_RATE_UNAVAILABLE and the amount is excluded, never a rate of 1.
 */
export function convertToAud(
  amount: number,
  currency: string,
  date: string,
  rates: readonly FxRate[],
): Conversion {
  if (currency === BASE_CURRENCY) return { status: "base", amountAud: amount };
  const rate = pickRate(rates, currency, date);
  if (!rate) {
    return {
      status: "unavailable",
      exception: "FX_RATE_UNAVAILABLE",
      excluded: { amount, currency },
    };
  }
  return {
    status: "converted",
    amountAud: fromCents(Math.round(toCents(amount) * rate.audPerUnit)),
    rate: rate.audPerUnit,
    rateDate: rate.date,
    source: rate.source,
  };
}

/** R-CUR-3: the summary shows excluded amounts per currency, not just a count. */
export function summariseExcluded(
  conversions: readonly Conversion[],
): { currency: string; amount: number; count: number }[] {
  const byCurrency = new Map<string, { cents: number; count: number }>();
  for (const c of conversions) {
    if (c.status !== "unavailable") continue;
    const entry = byCurrency.get(c.excluded.currency) ?? { cents: 0, count: 0 };
    entry.cents += toCents(c.excluded.amount);
    entry.count += 1;
    byCurrency.set(c.excluded.currency, entry);
  }
  return [...byCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, { cents, count }]) => ({ currency, amount: fromCents(cents), count }));
}

/**
 * R-CUR-5: the model infers currency from clues; this rule never fills a gap.
 * A missing, invalid, or low-confidence currency flags LOW_CONFIDENCE_FIELD and is
 * never assumed to be AUD.
 */
export function checkCurrency(
  field: { value: string | null; confidence: number },
  minConfidence: number,
): { currency: string | null; exceptions: ExceptionCode[] } {
  const currency = normaliseCurrency(field.value);
  const lowConfidence = currency === null || field.confidence < minConfidence;
  return { currency, exceptions: lowConfidence ? ["LOW_CONFIDENCE_FIELD"] : [] };
}
