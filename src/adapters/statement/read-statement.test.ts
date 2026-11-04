import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import {
  parseStatementDate,
  readStatement,
  StatementFormatError,
  slashOrder,
} from "./read-statement";

const ROOT = join(import.meta.dirname, "../../..");
const read = (name: string) => readFileSync(join(ROOT, "fixtures/dataset", name), "utf8");

const truth = JSON.parse(read("ground-truth.json")) as {
  statementLines: Record<string, unknown>[];
};
const expected = truth.statementLines.map(({ receiptId: _r, note: _n, ...line }) => line);

function problemsOf(text: string): string[] {
  try {
    readStatement(text);
  } catch (error) {
    if (error instanceof StatementFormatError) return error.problems;
    throw error;
  }
  throw new Error("expected a StatementFormatError");
}

const HEADER_A = "Date,Account,Description,Amount,Foreign Amount,Foreign Currency";
const HEADER_B = "Posted,Merchant Name,Account Type,Debit,Credit,Orig. Amount,Orig. Ccy";

describe("statement column mapping", () => {
  it("format A reads into exactly the ground-truth lines (real CRLF bytes)", () => {
    const { format, lines } = readStatement(read("statement-format-a.csv"));
    expect(format).toMatch(/^Format A/);
    expect(lines).toEqual(expected);
  });

  it("a US-style (month-first) export of the same month reads identically, and says so", () => {
    const us = read("statement-format-a.csv").replace(/^(\d{2})\/(\d{2})\//gm, "$2/$1/");
    expect(us).toContain("10/02/2026"); // 2 October, month first
    const { format, lines } = readStatement(us);
    expect(format).toContain("dates read month first");
    expect(lines).toEqual(expected);
  });

  it("format B (debit/credit columns, '02 Oct 2026' dates) gives identical lines", () => {
    const { format, lines } = readStatement(read("statement-format-b.csv"));
    expect(format).toMatch(/^Format B/);
    expect(lines).toEqual(expected);
  });

  it("finds columns by name, so a reordered export still reads", () => {
    const csv = `Amount,Date,Description,Account,Foreign Currency,Foreign Amount\r\n-12.40,02/10/2026,SAMPLE PHARMACY,Business Visa ...4821,,\r\n`;
    expect(readStatement(csv).lines[0]).toEqual({
      id: "L01",
      date: "2026-10-02",
      description: "SAMPLE PHARMACY",
      amountAud: 12.4,
      account: "company_card",
    });
  });

  it("a format B credit (refund) becomes a negative amount", () => {
    const csv = `${HEADER_B}\n03 Oct 2026,SAMPLE STORE REFUND,CREDIT CARD,,25.00,,\n`;
    expect(readStatement(csv).lines[0]?.amountAud).toBe(-25);
  });

  it("masks a card number that a bank put in a description", () => {
    const csv = `${HEADER_A}\n02/10/2026,Visa,PAYMENT 4111 1111 1111 1111 THANKS,-5.00,,\n`;
    expect(readStatement(csv).lines[0]?.description).toBe("PAYMENT •••• 1111 THANKS");
  });
});

describe("statement upload validation (friendly errors)", () => {
  it("an Excel or PDF file is refused with what to export instead", () => {
    expect(problemsOf("PK\u0003\u0004binary")).toEqual([
      expect.stringMatching(/not a CSV.*choose CSV/),
    ]);
  });

  it("an unknown layout lists the columns found and the supported formats", () => {
    const [first, second] = problemsOf("When,What,How much\n1,2,3\n");
    expect(first).toContain("found: When, What, How much");
    expect(second).toContain("Format A");
    expect(second).toContain("Format B");
  });

  it("a nearly-right layout names the missing column", () => {
    const problems = problemsOf("Posted,Merchant Name,Account Type,Debit,Credit,Orig. Amount\n");
    expect(problems[0]).toBe(
      'This looks like Format B (separate Debit and Credit columns), but the column "Orig. Ccy" is missing.',
    );
  });

  it("a header with no rows says so", () => {
    expect(problemsOf(`${HEADER_A}\r\n`)).toEqual([
      "The statement has column names but no transactions.",
    ]);
  });

  it("collects every bad row with its spreadsheet row number, not just the first", () => {
    const csv = [
      HEADER_B,
      "02/10/2026,A,CREDIT CARD,1.00,,,", // format A's date style in a format B file
      "02 Oct 2026,B,CREDIT CARD,1.00,2.00,,", // both debit and credit
      "02 Oct 2026,C,CREDIT CARD,,,,", // neither
      "31 Sep 2026,D,CREDIT CARD,abc,,15.00,", // impossible date, bad amount, currency missing
    ].join("\n");
    expect(problemsOf(csv)).toEqual([
      'Row 2: the date "02/10/2026" is not a date like 02 Oct 2026.',
      "Row 3: both Debit and Credit are filled in; only one should be.",
      "Row 4: Debit and Credit are both empty.",
      'Row 5: the date "31 Sep 2026" is not a date like 02 Oct 2026; the Debit or Credit value is not a number; a foreign amount needs both the amount and its currency.',
      "Fix these rows, then upload again.",
    ]);
  });

  it("dates are checked as real calendar dates in the format's style", () => {
    expect(parseStatementDate("02/10/2026", "dd/mm/yyyy")).toBe("2026-10-02");
    expect(parseStatementDate("31/02/2026", "dd/mm/yyyy")).toBeNull();
    expect(parseStatementDate("2 oct 2026", "dd Mon yyyy")).toBe("2026-10-02");
    expect(parseStatementDate("02/10/2026", "dd Mon yyyy")).toBeNull();
  });

  it("slash order: a number over 12 decides; otherwise the shorter period; a tie is day first", () => {
    expect(slashOrder(["25/10/2026", "03/10/2026"])).toBe("day-first");
    expect(slashOrder(["10/25/2026", "10/03/2026"])).toBe("month-first");
    expect(slashOrder(["25/10/2026", "10/25/2026"])).toBe("mixed");
    // Every date fits both ways: 2 to 9 October (month first) beats February to September.
    expect(slashOrder(["10/02/2026", "10/05/2026", "10/09/2026"])).toBe("month-first");
    // 1 to 12 October (day first) beats January to December.
    expect(slashOrder(["01/10/2026", "12/10/2026"])).toBe("day-first");
    expect(slashOrder(["05/05/2026"])).toBe("day-first");
  });

  it("a file mixing both orders is refused rather than read half wrong", () => {
    const csv = [
      HEADER_A,
      "25/10/2026,Business Visa ...4821,A,-1.00,,",
      "10/26/2026,Business Visa ...4821,B,-1.00,,",
    ].join("\n");
    expect(problemsOf(csv)[0]).toMatch(/day first .* month first/);
  });

  it("an ISO date reads in either format, and is still checked as a real date", () => {
    expect(parseStatementDate("2026-10-02", "dd/mm/yyyy")).toBe("2026-10-02");
    expect(parseStatementDate("2026-10-02", "dd Mon yyyy")).toBe("2026-10-02");
    expect(parseStatementDate("2026-02-31", "dd/mm/yyyy")).toBeNull();
  });

  it("a title row and a blank row above the header (stress S09) still read, with true row numbers", () => {
    const csv = [
      "Business Visa ...4821 - Transactions 01/10/2026 to 31/10/2026",
      "",
      HEADER_A,
      "2026-10-02,Business Visa ...4821,SAMPLE PHARMACY,-12.40,,",
      "2026-10-32,Business Visa ...4821,SAMPLE CAFE,-3.00,,",
    ].join("\r\n");
    expect(problemsOf(csv)).toEqual([
      'Row 5: the date "2026-10-32" is not a date like 02/10/2026.',
      "Fix these rows, then upload again.",
    ]);
    expect(readStatement(csv.split("\r\n").slice(0, 4).join("\r\n")).lines).toEqual([
      {
        id: "L01",
        date: "2026-10-02",
        description: "SAMPLE PHARMACY",
        amountAud: 12.4,
        account: "company_card",
      },
    ]);
  });

  it("CSV reader handles quoted commas, doubled quotes, and a byte-order mark", () => {
    expect(parseCsv('﻿a,"b, c","say ""hi"""\r\n1,2,3\r\n')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });
});
