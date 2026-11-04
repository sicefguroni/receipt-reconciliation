import { fromCents, toCents } from "@/core/money";
import { paymentSourceLabel } from "@/core/required";
import type { MonthResult } from "./reconcile";

// The month-end pack (03, v1 item 9): the ledger CSV, the exceptions log CSV, and the numbers
// for the readable summary page. Everything is computed from the reconciled month.

const LEDGER_COLUMNS = [
  "entry_id",
  "entry_type",
  "date",
  "vendor",
  "category",
  "business_purpose",
  "payment_source",
  "submitted_by",
  "receipt_total",
  "receipt_currency",
  "fx_rate",
  "fx_rate_date",
  "fx_source",
  "ledger_amount_aud",
  "difference_vs_receipt",
  "statement_line_id",
  "match_status",
  "payment_status",
  "included_in_totals",
  "outcome",
  "approved_by",
  "approved_at",
  "sign_off_reason",
  "flags",
] as const;

const EXCEPTION_COLUMNS = [
  "item_id",
  "item_type",
  "flag",
  "status",
  "resolution",
  "by",
  "at",
  "reason",
] as const;

/**
 * A spreadsheet runs a cell that starts with = + - @ (or a tab/CR) as a formula. Vendor names
 * come from a model reading uploaded files, so they are untrusted: prefix such cells with '.
 * Plain negative numbers are left alone so amounts stay numeric.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(header: readonly string[], rows: unknown[][]): string {
  // CRLF: what spreadsheet tools and bank exports use.
  const lines = [header.join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  return `${lines.join("\r\n")}\r\n`;
}

export function ledgerCsv(result: MonthResult): string {
  const receiptRows = result.receipts.map((r) => {
    const e = r.extraction;
    const c = r.conversion;
    return [
      r.id,
      "receipt",
      e?.date.value,
      e?.vendor.value,
      r.category?.category,
      r.businessPurpose,
      r.paymentSourceLabel,
      r.submitterId,
      e?.total.value?.toFixed(2),
      e?.currency.value,
      c?.status === "converted" ? c.rate : "",
      c?.status === "converted" ? c.rateDate : "",
      c?.status === "converted" ? c.source : "",
      r.state.ledgerAmountAud?.toFixed(2),
      r.difference
        ? `${r.difference.amount > 0 ? "+" : ""}${r.difference.amount.toFixed(2)} ${r.difference.currency}`
        : "",
      // A split payment lists every line it was paid by (R-MAT-10).
      r.match?.statementLineId
        ? [r.match.statementLineId, ...(r.match.extraLineIds ?? [])].join(" + ")
        : "",
      r.state.status,
      r.state.paymentStatus,
      r.state.excludedFromTotals ? "no" : "yes",
      r.outcome,
      r.approval?.by,
      r.approval?.at,
      r.signOff?.reason,
      r.state.exceptions.join(" "),
    ];
  });
  // R-MAT-7: a substitute is a ledger entry for a real payment whose receipt is missing.
  const substituteRows = result.noReceipt.flatMap(({ line, resolution }) =>
    resolution?.kind === "substitute"
      ? [
          [
            line.id,
            "substitute",
            line.date,
            line.description,
            resolution.category,
            resolution.stamp.reason,
            line.account === "bank"
              ? paymentSourceLabel("bank")
              : paymentSourceLabel("company_card"),
            "",
            "",
            "",
            "",
            "",
            "",
            line.amountAud.toFixed(2),
            "",
            line.id,
            "",
            "paid",
            "yes",
            "substitute",
            resolution.stamp.by,
            resolution.stamp.at,
            "",
            "",
          ],
        ]
      : [],
  );
  return csv(LEDGER_COLUMNS, [...receiptRows, ...substituteRows]);
}

export function exceptionsCsv(result: MonthResult): string {
  return csv(
    EXCEPTION_COLUMNS,
    result.exceptionLog.map((row) => [
      row.itemId,
      row.itemKind === "receipt" ? "receipt" : "statement line",
      row.code,
      row.open ? "open" : "resolved",
      row.resolution,
      row.stamp?.by,
      row.stamp?.at,
      row.stamp?.reason,
    ]),
  );
}

export interface Total {
  label: string;
  amountAud: number;
  count: number;
}

function totals(entries: { label: string; amount: number }[]): Total[] {
  const map = new Map<string, { cents: number; count: number }>();
  for (const e of entries) {
    const t = map.get(e.label) ?? { cents: 0, count: 0 };
    t.cents += toCents(e.amount);
    t.count += 1;
    map.set(e.label, t);
  }
  return [...map.entries()]
    .map(([label, t]) => ({ label, amountAud: fromCents(t.cents), count: t.count }))
    .sort((a, b) => b.amountAud - a.amountAud || a.label.localeCompare(b.label));
}

/** The readable summary: totals by category and by payment source, and what was left out. */
export function packSummary(result: MonthResult) {
  const included = result.receipts.filter(
    (r) => !r.state.excludedFromTotals && r.state.ledgerAmountAud !== null,
  );
  const substitutes = result.noReceipt.flatMap((n) =>
    n.resolution?.kind === "substitute" ? [{ line: n.line, category: n.resolution.category }] : [],
  );
  const entries = [
    ...included.map((r) => ({
      category: r.category?.category ?? "Uncategorised",
      source: r.state.reimbursement ? "Personal card (to reimburse)" : r.paymentSourceLabel,
      amount: r.state.ledgerAmountAud ?? 0,
    })),
    ...substitutes.map((s) => ({
      category: s.category,
      source: `${s.line.account === "bank" ? "Bank account" : "Company card"} (substitute, no receipt)`,
      amount: s.line.amountAud,
    })),
  ];
  return {
    byCategory: totals(entries.map((e) => ({ label: e.category, amount: e.amount }))),
    bySource: totals(entries.map((e) => ({ label: e.source, amount: e.amount }))),
    ledgerAud: result.totals.ledgerAud,
    entryCount: entries.length,
    excludedFx: result.totals.excludedFx,
    excludedReceipts: result.receipts.filter((r) => r.state.excludedFromTotals),
    noReceipt: result.noReceipt,
    openCount: result.queue.reduce((n, s) => n + s.items.length, 0),
    resolvedFlags: result.exceptionLog.filter((row) => !row.open).length,
    openFlags: result.exceptionLog.filter((row) => row.open).length,
  };
}
