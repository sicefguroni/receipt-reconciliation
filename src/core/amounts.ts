import { fromCents, toCents } from "./money";
import { BASE_CURRENCY, type Money } from "./schemas";

// Amount-difference rules R-AMT-1 to R-AMT-4, with R-CUR-4 for foreign purchases
// (docs/sprint/05-business-rules.md).

/** R-AMT-2 policy. Owned by the finance lead, so always passed in, never hard-coded. */
export interface AmountPolicy {
  pctThreshold: number; // e.g. 10 means 10%
  audThreshold: number; // e.g. 100 means $100 AUD
}

export interface ReceiptAmount {
  total: number;
  currency: string;
  /** The receipt total in AUD after R-CUR-2 conversion, when the receipt is foreign. */
  totalAud?: number | null;
}

export interface LineAmount {
  amountAud: number; // debits positive; this is the ledger amount
  originalAmount?: Money;
}

export type DifferenceKind = "none" | "small" | "over_threshold";

export interface AmountComparison {
  /** The currency the two amounts were compared in (R-CUR-4). */
  comparedIn: string;
  receiptAmount: number;
  lineAmount: number;
  /** Charged minus receipt, signed, in the compared currency. Drives the R-AMT-3 badge. */
  difference: number;
  /** R-AMT-1: |difference| in AUD. */
  differenceAud: number;
  kind: DifferenceKind;
}

/**
 * R-AMT-2: over pctThreshold % of the receipt amount OR over audThreshold AUD,
 * whichever triggers first. "Over" is strict: exactly 10% or exactly $100 is not over.
 */
export function isOverThreshold(
  differenceAudCents: number,
  receiptCents: number,
  differenceCents: number,
  policy: AmountPolicy,
): boolean {
  const overPct = Math.abs(differenceCents) * 100 > Math.abs(receiptCents) * policy.pctThreshold;
  const overAud = differenceAudCents > toCents(policy.audThreshold);
  return overPct || overAud;
}

/**
 * R-AMT-1 with R-CUR-4. When the statement line carries the original foreign amount in
 * the receipt's currency, compare in that currency, so the bank's FX margin and fees are
 * not a difference; the AUD charge stays the ledger amount. Otherwise compare in AUD.
 * Returns null when a foreign receipt has no AUD value yet (FX unavailable).
 *
 * R-AMT-3: a difference above $0.01 that is not over the threshold is "small": a normal
 * match with a badge, no reason needed.
 */
export function compareAmounts(
  receipt: ReceiptAmount,
  line: LineAmount,
  policy: AmountPolicy,
): AmountComparison | null {
  let comparedIn: string;
  let receiptCents: number;
  let lineCents: number;
  let audPerUnit: number;

  if (line.originalAmount && line.originalAmount.currency === receipt.currency) {
    comparedIn = receipt.currency;
    receiptCents = toCents(receipt.total);
    lineCents = toCents(line.originalAmount.amount);
    // The bank's own implied rate turns the foreign gap into AUD for the $100 test.
    audPerUnit = line.originalAmount.amount === 0 ? 1 : line.amountAud / line.originalAmount.amount;
  } else {
    const receiptAud = receipt.currency === BASE_CURRENCY ? receipt.total : receipt.totalAud;
    if (receiptAud == null) return null;
    comparedIn = BASE_CURRENCY;
    receiptCents = toCents(receiptAud);
    lineCents = toCents(line.amountAud);
    audPerUnit = 1;
  }

  const differenceCents = lineCents - receiptCents;
  const differenceAudCents = Math.round(Math.abs(differenceCents) * audPerUnit);
  let kind: DifferenceKind = "none";
  if (Math.abs(differenceCents) > 1) {
    kind = isOverThreshold(differenceAudCents, receiptCents, differenceCents, policy)
      ? "over_threshold"
      : "small";
  }

  return {
    comparedIn,
    receiptAmount: fromCents(receiptCents),
    lineAmount: fromCents(lineCents),
    difference: fromCents(differenceCents),
    differenceAud: fromCents(differenceAudCents),
    kind,
  };
}

/** R-AMT-4: signing off an over-threshold difference needs a reason of 3+ characters. */
export function isValidSignOffReason(reason: string | null | undefined): boolean {
  return (reason?.trim().length ?? 0) >= 3;
}
