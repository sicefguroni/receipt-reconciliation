import { type AmountComparison, type AmountPolicy, compareAmounts } from "./amounts";
import { normaliseVendor } from "./duplicates";
import { fromCents, toCents } from "./money";
import { accountMatchesSource } from "./required";
import type { ExceptionCode, MatchStatus, PaymentSource, StatementLine } from "./schemas";

// Matching rules R-MAT-1 to R-MAT-10 (docs/sprint/05-business-rules.md).

/** R-MAT-1 thresholds are tuned on Day 4 (tuning split only), so they are always passed in. */
export interface MatchPolicy extends AmountPolicy {
  minScore: number; // e.g. 75
  minMargin: number; // e.g. 20
  /** R-MAT-9: a line further than this from the receipt date is not a candidate. e.g. 7 */
  maxDaysApart: number;
}

export interface MatchReceipt {
  id: string;
  total: number | null;
  currency: string | null;
  /** R-CUR-2 conversion, for a foreign receipt compared against an AUD-only line. */
  totalAud?: number | null;
  date: string | null;
  vendor: string | null;
  paymentSource: PaymentSource;
}

export interface Candidate {
  statementLineId: string;
  score: number;
  /** R-MAT-6: plain-language reasons, shown next to every auto-match and candidate. */
  reasons: string[];
  amount: AmountComparison | null;
}

export interface MatchOutcome {
  receiptId: string;
  status: MatchStatus;
  statementLineId: string | null;
  candidates: Candidate[]; // top 3
  exceptions: ExceptionCode[];
  /** R-MAT-3: a personal-card receipt with no line is offered as a reimbursement. */
  reimbursement: boolean;
  /** R-MAT-10: further lines a person said also paid this receipt (a split payment). */
  extraLineIds?: string[];
}

const WINDOW_DAYS = 5; // "same month, plus 5 days either side"
export const MIN_CANDIDATE_SCORE = 40; // R-MAT-2 / R-MAT-3 boundary
const MAX_CANDIDATES = 3;

function dayNumber(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000;
}

/** Is the line dated within the receipt's month, widened by 5 days either side? */
export function inMatchWindow(lineDate: string, monthKey: string): boolean {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return false;
  const first = Date.UTC(year, month - 1, 1) / 86_400_000;
  const last = Date.UTC(year, month, 0) / 86_400_000;
  const day = dayNumber(lineDate);
  return day >= first - WINDOW_DAYS && day <= last + WINDOW_DAYS;
}

/**
 * Normalised token overlap: the share of the vendor's words that appear in the statement
 * description. Banks append city and country words, so the description is not penalised
 * for extra words; the vendor's own words are what must be found.
 */
export function vendorSimilarity(vendor: string, description: string): number {
  const vendorWords = new Set(normaliseVendor(vendor).split(" ").filter(Boolean));
  if (vendorWords.size === 0) return 0;
  const description_ = normaliseVendor(description).split(" ").filter(Boolean);
  const descriptionWords = new Set(description_);
  let found = 0;
  for (const word of vendorWords) if (descriptionWords.has(word)) found += 1;
  const overlap = found / vendorWords.size;
  if (overlap < 1 && runTogether([...vendorWords].join(""), description_)) return 1;
  return overlap;
}

/**
 * R-MAT vendor signal, Day 4 (failure F5): a logo prints the name as one word
 * ("brightreachads") where the bank writes "BRIGHTREACH ADS", or the reverse. They are the
 * same name if the run-together vendor equals consecutive whole words of the description.
 * Whole words only, so a short name never matches inside an unrelated word.
 */
function runTogether(compactVendor: string, descriptionWords: readonly string[]): boolean {
  for (let start = 0; start < descriptionWords.length; start++) {
    let joined = "";
    for (let end = start; end < descriptionWords.length; end++) {
      joined += descriptionWords[end];
      if (joined === compactVendor) return true;
      if (joined.length >= compactVendor.length) break;
    }
  }
  return false;
}

function formatAud(amount: number): string {
  return `$${Math.abs(amount).toFixed(2)}`;
}

function daysApart(a: string, b: string): number {
  return Math.abs(dayNumber(a) - dayNumber(b));
}

function datePoints(receiptDate: string | null, lineDate: string): [number, string | null] {
  if (!receiptDate) return [0, null];
  const days = daysApart(lineDate, receiptDate);
  const label = days === 0 ? "same day" : days === 1 ? "1 day apart" : `${days} days apart`;
  if (days <= 1) return [25, label];
  if (days <= 3) return [15, label];
  if (days <= 5) return [5, label];
  return [0, null];
}

/** R-MAT scoring table for one (receipt, statement line) pair, with R-MAT-6 reasons. */
export function scorePair(
  receipt: MatchReceipt,
  line: StatementLine,
  policy: AmountPolicy,
): Candidate {
  const reasons: string[] = [];
  let score = 0;

  const amount =
    receipt.total === null || receipt.currency === null
      ? null
      : compareAmounts(
          { total: receipt.total, currency: receipt.currency, totalAud: receipt.totalAud },
          line,
          policy,
        );
  if (amount === null) {
    reasons.push("amount could not be compared");
  } else if (amount.kind === "none") {
    score += 50;
    reasons.push("same amount");
  } else if (amount.kind === "small") {
    score += 30; // R-AMT-3: within the threshold
    reasons.push(`amount differs by ${formatAud(amount.difference)} (within policy)`);
  } else {
    // R-AMT-2: an over-threshold line earns no amount points, so it is never auto-paired.
    reasons.push(`amount differs by ${formatAud(amount.difference)} (over policy)`);
  }

  const [datePts, dateLabel] = datePoints(receipt.date, line.date);
  score += datePts;
  if (dateLabel) reasons.push(dateLabel);

  if (receipt.vendor) {
    const similarity = vendorSimilarity(receipt.vendor, line.description);
    if (similarity >= 0.6) {
      score += 20;
      reasons.push("vendor name matches");
    } else if (similarity >= 0.3) {
      score += 10;
      reasons.push("vendor name partly matches");
    }
  }

  if (accountMatchesSource(receipt.paymentSource, line.account)) {
    score += 5;
    reasons.push("paid from the stated account");
  }

  return { statementLineId: line.id, score, reasons, amount };
}

/**
 * R-MAT-8: a credit (refund, reversal) is money coming back, never a receipt's payment. Its
 * date, vendor, and account can still score 40 or more, which made it a candidate (Day 4, S08).
 */
export function isCredit(line: Pick<StatementLine, "amountAud">): boolean {
  return line.amountAud < 0;
}

/** Candidates sorted by score (highest first); ties broken by line id so runs are repeatable. */
export function rankCandidates(
  receipt: MatchReceipt,
  lines: readonly StatementLine[],
  policy: MatchPolicy,
): Candidate[] {
  if (receipt.total === null) return [];
  const { date } = receipt;
  return lines
    .filter((line) => !isCredit(line)) // R-MAT-8
    .filter((line) => !date || daysApart(date, line.date) <= policy.maxDaysApart) // R-MAT-9
    .map((line) => scorePair(receipt, line, policy))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.statementLineId.localeCompare(b.statementLineId));
}

/**
 * R-MAT-1: auto-match only if the best score is >= minScore and beats the runner-up by
 * >= minMargin. R-MAT-2: best >= 40 but R-MAT-1 fails means ambiguous. R-MAT-3: best < 40
 * means unmatched; a personal card is a reimbursement, anything else is NO_PAYMENT_FOUND.
 */
export function decideMatch(
  receipt: MatchReceipt,
  ranked: readonly Candidate[],
  policy: MatchPolicy,
): MatchOutcome {
  const [best, runnerUp] = ranked;
  const top = ranked.slice(0, MAX_CANDIDATES);
  const base = { receiptId: receipt.id, candidates: top };

  if (
    best &&
    best.score >= policy.minScore &&
    best.score - (runnerUp?.score ?? 0) >= policy.minMargin
  ) {
    return {
      ...base,
      status: "matched",
      statementLineId: best.statementLineId,
      exceptions: [],
      reimbursement: false,
    };
  }
  if (best && best.score >= MIN_CANDIDATE_SCORE) {
    return {
      ...base,
      status: "ambiguous",
      statementLineId: null,
      exceptions: ["AMBIGUOUS_MATCH"],
      reimbursement: false,
    };
  }
  const reimbursement = receipt.paymentSource === "personal_card";
  return {
    ...base,
    status: "unmatched",
    statementLineId: null,
    exceptions: reimbursement ? [] : ["NO_PAYMENT_FOUND"],
    reimbursement,
  };
}

/**
 * R-MAT-4: a line goes to at most one receipt. Assign greedily by highest score: the receipt
 * whose best available candidate scores highest is decided first, and a line it takes is
 * removed before the next receipt is scored. Receipts that end ambiguous or unmatched take
 * no line. Returns outcomes in the input order.
 */
export function matchReceipts(
  receipts: readonly MatchReceipt[],
  lines: readonly StatementLine[],
  monthKey: string,
  policy: MatchPolicy,
): MatchOutcome[] {
  const free = new Map(
    lines.filter((l) => inMatchWindow(l.date, monthKey)).map((l) => [l.id, l] as const),
  );
  const pending = new Map(receipts.map((r) => [r.id, r] as const));
  const outcomes = new Map<string, MatchOutcome>();

  while (pending.size > 0) {
    let next: { receipt: MatchReceipt; ranked: Candidate[] } | null = null;
    for (const receipt of pending.values()) {
      const ranked = rankCandidates(receipt, [...free.values()], policy);
      const score = ranked[0]?.score ?? -1;
      const nextScore = next?.ranked[0]?.score ?? -1;
      if (!next || score > nextScore || (score === nextScore && receipt.id < next.receipt.id)) {
        next = { receipt, ranked };
      }
    }
    if (!next) break;
    const outcome = decideMatch(next.receipt, next.ranked, policy);
    outcomes.set(next.receipt.id, outcome);
    pending.delete(next.receipt.id);
    if (outcome.statementLineId) free.delete(outcome.statementLineId);
  }

  return receipts.flatMap((r) => outcomes.get(r.id) ?? []);
}

/**
 * A human `choose_match` decision (R-MAT-5). Choosing a line whose difference is over the
 * threshold sets `amount_differs` and fires AMOUNT_DIFFERS_OVER_THRESHOLD (R-AMT-2, TC04).
 */
export function applyChosenLine(
  receipt: MatchReceipt,
  line: StatementLine,
  policy: AmountPolicy,
): MatchOutcome {
  const candidate = scorePair(receipt, line, policy);
  const over = candidate.amount?.kind === "over_threshold";
  return {
    receiptId: receipt.id,
    status: over ? "amount_differs" : "matched",
    statementLineId: line.id,
    candidates: [candidate],
    exceptions: over ? ["AMOUNT_DIFFERS_OVER_THRESHOLD"] : [],
    reimbursement: false,
  };
}

/**
 * R-MAT-10: one payment made of several lines (a deposit and a balance, for example). Amounts
 * add up; the original amount adds up only when every line shows it in the same currency, so
 * R-CUR-4 still compares a foreign receipt in its own currency. Date, description, and account
 * are the first line's.
 */
export function combinedPayment(lines: readonly StatementLine[]): StatementLine {
  const [first, ...rest] = lines;
  if (!first) throw new Error("A split payment needs at least one line.");
  const cents = lines.reduce((sum, l) => sum + toCents(l.amountAud), 0);
  const currency = first.originalAmount?.currency;
  const sameForeign =
    currency !== undefined && rest.every((l) => l.originalAmount?.currency === currency);
  return {
    ...first,
    amountAud: fromCents(cents),
    originalAmount: sameForeign
      ? {
          amount: fromCents(lines.reduce((s, l) => s + toCents(l.originalAmount?.amount ?? 0), 0)),
          currency,
        }
      : undefined,
  };
}

/**
 * R-MAT-10: a person's choice of several lines for one receipt. The amount rules (R-AMT)
 * apply to their sum, so a split that adds up is a plain match, and one that does not is an
 * amount difference to sign off. The first line is the one the match is reported against.
 */
export function applyChosenLines(
  receipt: MatchReceipt,
  lines: readonly StatementLine[],
  policy: AmountPolicy,
): MatchOutcome {
  const [first] = lines;
  if (!first) throw new Error("Choose at least one line.");
  if (lines.length === 1) return applyChosenLine(receipt, first, policy);
  const outcome = applyChosenLine(receipt, combinedPayment(lines), policy);
  const [candidate] = outcome.candidates;
  return {
    ...outcome,
    candidates: candidate
      ? [{ ...candidate, reasons: [`paid in ${lines.length} payments`, ...candidate.reasons] }]
      : [],
    extraLineIds: lines.slice(1).map((l) => l.id),
  };
}

const SOURCE_TEXT: Record<PaymentSource, string> = {
  company_card: "the company card",
  personal_card: "a personal card",
  bank: "the bank account",
  unknown: "an unknown source",
};
const ACCOUNT_TEXT: Record<StatementLine["account"], string> = {
  company_card: "the company card",
  personal_card: "a personal card",
  bank: "the bank account",
};

/**
 * R-MAT-6, Day 4 (C1): what does not fit between a receipt and the payment it is paired with,
 * in plain words, shown before a person signs off or approves. In the builder's run a $14.70
 * coffee was paired with a $75.20 petrol charge and signed off as "Good"; nothing on the
 * screen said the two had nothing in common. Empty when the pairing looks right.
 */
export function pairingConcerns(
  receipt: MatchReceipt,
  line: StatementLine,
  candidate: Candidate,
): string[] {
  const concerns: string[] = [];
  if (candidate.score < MIN_CANDIDATE_SCORE)
    concerns.push("It was not one of the suggested payments.");
  if (receipt.vendor && vendorSimilarity(receipt.vendor, line.description) < 0.3) {
    concerns.push(
      `The payment is "${line.description}", which does not look like ${receipt.vendor}.`,
    );
  }
  const amount = candidate.amount;
  if (amount === null) {
    concerns.push("The amounts could not be compared.");
  } else if (amount.kind === "over_threshold" && amount.receiptAmount !== 0) {
    const pct = Math.round((Math.abs(amount.difference) / Math.abs(amount.receiptAmount)) * 100);
    const fmt = (v: number) =>
      amount.comparedIn === "AUD" ? formatAud(v) : `${amount.comparedIn} ${Math.abs(v).toFixed(2)}`;
    concerns.push(
      `It charged ${fmt(amount.lineAmount)} for a ${fmt(amount.receiptAmount)} receipt (${pct}% ${amount.difference > 0 ? "more" : "less"}).`,
    );
  }
  if (receipt.date) {
    const days = daysApart(receipt.date, line.date);
    if (days > 3) concerns.push(`It is ${days} days from the receipt date.`);
  }
  if (
    receipt.paymentSource !== "unknown" &&
    !accountMatchesSource(receipt.paymentSource, line.account)
  ) {
    concerns.push(
      `The receipt says it was paid with ${SOURCE_TEXT[receipt.paymentSource]}, but this payment is on ${ACCOUNT_TEXT[line.account]}.`,
    );
  }
  return concerns;
}

/** R-MAT-11: how far off an amount may be, as a share of the receipt, before a pairing that
 * is also not suggested and from another vendor is refused. */
export const CLEAR_MISMATCH_SHARE = 0.5;

/**
 * R-MAT-11 (Day 4, P1; candidate's ruling): a person may not pair a receipt with a payment that
 * is clearly someone else's: not one of the suggested payments, a vendor that does not look
 * alike, and an amount more than half off. Both cold runs did exactly this and signed it off
 * (C1: a $14.70 coffee with a $75.20 petrol charge; P1, with the pairing check on screen: a
 * $268 hotel with a $10 card fee). Returns the refusal for the person, or null.
 */
export function clearMismatch(
  receipt: MatchReceipt,
  line: StatementLine,
  policy: AmountPolicy,
): string | null {
  const candidate = scorePair(receipt, line, policy);
  if (candidate.score >= MIN_CANDIDATE_SCORE) return null;
  if (!receipt.vendor || vendorSimilarity(receipt.vendor, line.description) >= 0.3) return null;
  const amount = candidate.amount;
  if (!amount || amount.receiptAmount === 0) return null;
  const share = Math.abs(amount.difference) / Math.abs(amount.receiptAmount);
  if (share <= CLEAR_MISMATCH_SHARE) return null;
  const pct = Math.round(share * 100);
  return (
    `${line.id} (${line.description}, ${formatAud(line.amountAud)}) does not look like this receipt's payment: ` +
    `a different vendor, ${pct}% ${amount.difference > 0 ? "more" : "less"}, and not one of the suggested payments. ` +
    "Choose another payment, reimburse, or remove the receipt."
  );
}

/** R-MAT-5: paid if and only if matched or amount_differs, with a statement line. */
export function paymentStatus(
  status: MatchStatus,
  statementLineId: string | null,
): "paid" | "unpaid" {
  return (status === "matched" || status === "amount_differs") && statementLineId !== null
    ? "paid"
    : "unpaid";
}

/**
 * R-MAT-7: after matching and the human's match decisions, every line not matched to a
 * receipt is listed as "No receipt". It stays out of the ledger until resolved.
 */
export function linesWithoutReceipt(
  lines: readonly StatementLine[],
  matchedLineIds: Iterable<string>,
): StatementLine[] {
  const taken = new Set(matchedLineIds);
  return lines.filter((l) => !taken.has(l.id));
}
