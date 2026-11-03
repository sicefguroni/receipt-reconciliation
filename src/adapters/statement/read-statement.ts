import { maskCardNumbers } from "@/core/privacy";
import { type StatementAccount, StatementLine } from "@/core/schemas";
import { parseCsv } from "./csv";

// Statement reading with column mapping. Each bank format is a mapping from its column names
// to the StatementLine fields. Columns are found by name (any order, case ignored), so a bank
// that reorders its export still reads. Adding a format means adding one entry below.

type DateStyle = "dd/mm/yyyy" | "dd Mon yyyy";

interface StatementFormat {
  name: string;
  date: { column: string; style: DateStyle };
  description: string;
  account: string;
  /** One signed column (debits negative), or separate positive debit and credit columns. */
  amount: { signed: string } | { debit: string; credit: string };
  foreignAmount: string;
  foreignCurrency: string;
}

export const STATEMENT_FORMATS: readonly StatementFormat[] = [
  {
    name: "Format A (one signed Amount column)",
    date: { column: "Date", style: "dd/mm/yyyy" },
    description: "Description",
    account: "Account",
    amount: { signed: "Amount" },
    foreignAmount: "Foreign Amount",
    foreignCurrency: "Foreign Currency",
  },
  {
    name: "Format B (separate Debit and Credit columns)",
    date: { column: "Posted", style: "dd Mon yyyy" },
    description: "Merchant Name",
    account: "Account Type",
    amount: { debit: "Debit", credit: "Credit" },
    foreignAmount: "Orig. Amount",
    foreignCurrency: "Orig. Ccy",
  },
];

function columnsOf(format: StatementFormat): string[] {
  const amount =
    "signed" in format.amount
      ? [format.amount.signed]
      : [format.amount.debit, format.amount.credit];
  return [
    format.date.column,
    format.account,
    format.description,
    ...amount,
    format.foreignAmount,
    format.foreignCurrency,
  ];
}

/** Every problem found, written for the Accounting user. `message` is the first few, joined. */
export class StatementFormatError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.slice(0, 4).join(" "));
    this.name = "StatementFormatError";
  }
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function isRealDate(y: number, m: number, d: number): boolean {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** ISO date, or null when the text is not a real date in the format's style. */
export function parseStatementDate(text: string, style: DateStyle): string | null {
  const match =
    style === "dd/mm/yyyy"
      ? /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
      : /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec(text);
  if (!match) return null;
  const [, d, m, y] = match;
  const month = style === "dd/mm/yyyy" ? Number(m) : MONTHS.indexOf(String(m).toLowerCase()) + 1;
  if (!isRealDate(Number(y), month, Number(d))) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "1,234.50", "$12.40", "-12.40" → number; "" → null; anything else → NaN. */
function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

function accountKind(label: string): StatementAccount {
  // Card products are named by network or "card"; anything else is the business bank account.
  return /visa|mastercard|amex|card/i.test(label) ? "company_card" : "bank";
}

const EXAMPLE: Record<DateStyle, string> = {
  "dd/mm/yyyy": "02/10/2026",
  "dd Mon yyyy": "02 Oct 2026",
};

function detect(header: string[]): StatementFormat {
  const found = new Set(header.map((h) => h.trim().toLowerCase()));
  const missing = (f: StatementFormat) => columnsOf(f).filter((c) => !found.has(c.toLowerCase()));
  const exact = STATEMENT_FORMATS.find((f) => missing(f).length === 0);
  if (exact) return exact;

  const closest = [...STATEMENT_FORMATS].sort((a, b) => missing(a).length - missing(b).length)[0];
  const closestMissing = closest ? missing(closest) : [];
  const shown = header.map((h) => h.trim()).filter(Boolean);
  if (closest && closestMissing.length <= 2) {
    throw new StatementFormatError([
      `This looks like ${closest.name}, but the column${closestMissing.length > 1 ? "s" : ""} ` +
        `${closestMissing.map((c) => `"${c}"`).join(" and ")} ${closestMissing.length > 1 ? "are" : "is"} missing.`,
      "Export the statement again with all columns included.",
    ]);
  }
  throw new StatementFormatError([
    `The statement's columns were not recognised (found: ${shown.join(", ") || "none"}).`,
    `Supported: ${STATEMENT_FORMATS.map((f) => `${f.name}: ${columnsOf(f).join(", ")}`).join("; ")}.`,
    "Export it again in one of these layouts.",
  ]);
}

/**
 * Reads a bank statement CSV in any supported format. Lines get ids L01, L02, ... in file
 * order, and debits become positive amounts (04). All row problems are collected, so the
 * user can fix the file in one pass instead of one error at a time.
 */
export function readStatement(text: string): { format: string; lines: StatementLine[] } {
  if (text.startsWith("PK") || text.startsWith("%PDF") || text.includes("\u0000")) {
    throw new StatementFormatError([
      "This file is not a CSV. In the bank's export screen, choose CSV (not Excel or PDF).",
    ]);
  }
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new StatementFormatError(["The statement file is empty."]);
  const format = detect(header);
  if (rows.length === 0) {
    throw new StatementFormatError(["The statement has column names but no transactions."]);
  }

  const index = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]));
  const problems: string[] = [];
  const lines: StatementLine[] = [];

  rows.forEach((cells, i) => {
    const rowNumber = i + 2; // the header is row 1, as a spreadsheet shows it
    const get = (column: string) => cells[index.get(column.toLowerCase()) ?? -1]?.trim() ?? "";
    const rowProblems: string[] = [];

    const rawDate = get(format.date.column);
    const date = parseStatementDate(rawDate, format.date.style);
    if (!date) {
      rowProblems.push(`the date "${rawDate}" is not a date like ${EXAMPLE[format.date.style]}`);
    }

    let amountAud: number | null = null;
    if ("signed" in format.amount) {
      const signed = parseAmount(get(format.amount.signed));
      if (signed === null || Number.isNaN(signed)) {
        rowProblems.push(`the amount "${get(format.amount.signed)}" is not a number`);
      } else {
        amountAud = -signed; // format A: debits are negative
      }
    } else {
      const debit = parseAmount(get(format.amount.debit));
      const credit = parseAmount(get(format.amount.credit));
      if (Number.isNaN(debit) || Number.isNaN(credit)) {
        rowProblems.push("the Debit or Credit value is not a number");
      } else if (debit !== null && credit !== null) {
        rowProblems.push("both Debit and Credit are filled in; only one should be");
      } else if (debit === null && credit === null) {
        rowProblems.push("Debit and Credit are both empty");
      } else {
        amountAud = debit ?? -(credit ?? 0);
      }
    }

    const description = maskCardNumbers(get(format.description));
    if (!description) rowProblems.push("the description is empty");

    const foreignText = get(format.foreignAmount);
    const foreignCurrency = get(format.foreignCurrency).toUpperCase();
    const foreignAmount = parseAmount(foreignText);
    if (Number.isNaN(foreignAmount)) {
      rowProblems.push(`the foreign amount "${foreignText}" is not a number`);
    } else if ((foreignAmount === null) !== (foreignCurrency === "")) {
      rowProblems.push("a foreign amount needs both the amount and its currency");
    } else if (foreignCurrency && !/^[A-Z]{3}$/.test(foreignCurrency)) {
      rowProblems.push(`"${foreignCurrency}" is not a 3-letter currency code`);
    }

    if (rowProblems.length > 0) {
      problems.push(`Row ${rowNumber}: ${rowProblems.join("; ")}.`);
      return;
    }
    lines.push(
      StatementLine.parse({
        id: `L${String(i + 1).padStart(2, "0")}`,
        date,
        description,
        amountAud: Math.round((amountAud ?? 0) * 100) / 100 || 0, // never -0
        originalAmount:
          foreignAmount !== null && foreignCurrency
            ? { amount: Math.abs(foreignAmount), currency: foreignCurrency }
            : undefined,
        account: accountKind(get(format.account)),
      }),
    );
  });

  if (problems.length > 0) {
    const more = problems.length > 4 ? [`…and ${problems.length - 4} more rows.`] : [];
    throw new StatementFormatError([
      ...problems.slice(0, 4),
      ...more,
      "Fix these rows, then upload again.",
    ]);
  }
  return { format: format.name, lines };
}
