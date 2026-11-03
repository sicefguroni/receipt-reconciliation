import { z } from "zod";
import { type StatementAccount, StatementLine } from "@/core/schemas";
import { parseCsv } from "./csv";

// v0 reader for one bank format ("format A": signed amounts, dd/mm/yyyy). Day 3 replaces
// this with a column-mapping step that also handles format B.

const HEADER = ["Date", "Account", "Description", "Amount", "Foreign Amount", "Foreign Currency"];

const Row = z.object({
  date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date must look like 02/10/2026 (dd/mm/yyyy)"),
  account: z.string().min(1),
  description: z.string().min(1),
  amount: z.coerce.number().finite(),
  foreignAmount: z.string(),
  foreignCurrency: z.string(),
});

function accountKind(label: string): StatementAccount {
  // Card products are named by network; the business transaction account is the bank.
  return /visa|mastercard|amex|card/i.test(label) ? "company_card" : "bank";
}

export class StatementFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatementFormatError";
  }
}

/** Lines get ids L01, L02, ... in file order. Debits become positive amounts (04). */
export function parseFormatA(text: string): StatementLine[] {
  const [header, ...rows] = parseCsv(text);
  if (!header || HEADER.some((h, i) => header[i]?.trim() !== h)) {
    throw new StatementFormatError(
      `This statement's columns are not the expected format (${HEADER.join(", ")}). ` +
        "Export it again with those columns.",
    );
  }
  return rows.map((cells, index) => {
    const parsed = Row.safeParse({
      date: cells[0]?.trim(),
      account: cells[1]?.trim(),
      description: cells[2]?.trim(),
      amount: cells[3]?.trim(),
      foreignAmount: cells[4]?.trim() ?? "",
      foreignCurrency: cells[5]?.trim() ?? "",
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new StatementFormatError(
        `Statement row ${index + 2} could not be read: ${issue?.path.join(".")}: ${issue?.message}.`,
      );
    }
    const r = parsed.data;
    const [dd, mm, yyyy] = r.date.split("/");
    const foreign =
      r.foreignAmount && r.foreignCurrency
        ? { amount: Number(r.foreignAmount), currency: r.foreignCurrency.toUpperCase() }
        : undefined;
    return StatementLine.parse({
      id: `L${String(index + 1).padStart(2, "0")}`,
      date: `${yyyy}-${mm}-${dd}`,
      description: r.description,
      amountAud: Math.round(-r.amount * 100) / 100,
      originalAmount: foreign,
      account: accountKind(r.account),
    });
  });
}
