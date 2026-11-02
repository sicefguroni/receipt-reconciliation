import type { DatasetLine } from "./scenarios";

// The same transactions in two bank export formats. Day 3's column mapping must turn
// both into identical StatementLine rows (ground-truth.json "statementLines").

function cell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(header: string[], rows: (string | number)[][]): string {
  return `${[header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}

function ddmmyyyy(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dMonYyyy(iso: string): string {
  return `${iso.slice(8, 10)} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

// Format A: one signed amount column (debits negative), dd/mm/yyyy, account by name.
export function toFormatA(lines: DatasetLine[], withLineIds = false): string {
  const header = ["Date", "Account", "Description", "Amount", "Foreign Amount", "Foreign Currency"];
  const rows = lines.map((l) => [
    ...(withLineIds ? [l.id] : []),
    ddmmyyyy(l.date),
    l.account === "bank" ? "Business Transaction ...0937" : "Business Visa ...4821",
    l.description,
    (-l.amountAud).toFixed(2),
    l.originalAmount ? l.originalAmount.amount.toFixed(2) : "",
    l.originalAmount?.currency ?? "",
  ]);
  return csv(withLineIds ? ["Line", ...header] : header, rows);
}

// Format B: separate debit/credit columns (positive numbers), "02 Oct 2026" dates.
export function toFormatB(lines: DatasetLine[]): string {
  const header = [
    "Posted",
    "Merchant Name",
    "Account Type",
    "Debit",
    "Credit",
    "Orig. Amount",
    "Orig. Ccy",
  ];
  const rows = lines.map((l) => [
    dMonYyyy(l.date),
    l.description,
    l.account === "bank" ? "TRANSACTION" : "CREDIT CARD",
    l.amountAud >= 0 ? l.amountAud.toFixed(2) : "",
    l.amountAud < 0 ? (-l.amountAud).toFixed(2) : "",
    l.originalAmount ? l.originalAmount.amount.toFixed(2) : "",
    l.originalAmount?.currency ?? "",
  ]);
  return csv(header, rows);
}
