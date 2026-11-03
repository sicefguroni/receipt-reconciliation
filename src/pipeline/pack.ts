import type { MonthResult } from "./run-month";

// Month-end pack, v0: the ledger CSV. Day 3 adds the exceptions log and the summary.

const COLUMNS = [
  "receipt_id",
  "date",
  "vendor",
  "category",
  "business_purpose",
  "payment_source",
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
  "flags",
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

export function ledgerCsv(result: MonthResult): string {
  const rows = result.receipts.map((r) => {
    const e = r.extraction;
    const c = r.conversion;
    return [
      r.id,
      e?.date.value,
      e?.vendor.value,
      r.category?.category,
      r.businessPurpose,
      r.paymentSourceLabel,
      e?.total.value?.toFixed(2),
      e?.currency.value,
      c?.status === "converted" ? c.rate : "",
      c?.status === "converted" ? c.rateDate : "",
      c?.status === "converted" ? c.source : "",
      r.state.ledgerAmountAud?.toFixed(2),
      r.difference
        ? `${r.difference.amount > 0 ? "+" : ""}${r.difference.amount.toFixed(2)} ${r.difference.currency}`
        : "",
      r.match?.statementLineId,
      r.state.status,
      r.state.paymentStatus,
      r.state.excludedFromTotals ? "no" : "yes",
      r.state.exceptions.join(" "),
    ].map(csvCell);
  });
  // CRLF: what spreadsheet tools and bank exports use.
  return `${[COLUMNS.join(","), ...rows.map((r) => r.join(","))].join("\r\n")}\r\n`;
}
