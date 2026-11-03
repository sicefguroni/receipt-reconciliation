import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { parseFormatA, StatementFormatError } from "./format-a";

const ROOT = join(import.meta.dirname, "../../..");

describe("statement format A", () => {
  it("reads the October statement into exactly the ground-truth lines (real CRLF bytes)", () => {
    const csv = readFileSync(join(ROOT, "fixtures/dataset/statement-format-a.csv"), "utf8");
    const truth = JSON.parse(
      readFileSync(join(ROOT, "fixtures/dataset/ground-truth.json"), "utf8"),
    ) as { statementLines: Record<string, unknown>[] };
    const expected = truth.statementLines.map(({ receiptId: _r, note: _n, ...line }) => line);
    expect(parseFormatA(csv)).toEqual(expected);
  });

  it("refuses an unexpected header with a message that says what to do", () => {
    expect(() => parseFormatA("Posted,Merchant Name\n02 Oct 2026,X\n")).toThrow(
      StatementFormatError,
    );
    expect(() => parseFormatA("Posted,Merchant Name\n")).toThrow(/Export it again/);
  });

  it("names the row and field when a value is unreadable", () => {
    const csv =
      "Date,Account,Description,Amount,Foreign Amount,Foreign Currency\n2026-10-02,Visa,X,-1,,\n";
    expect(() => parseFormatA(csv)).toThrow(/row 2 could not be read: date/);
  });

  it("CSV reader handles quoted commas, doubled quotes, and a byte-order mark", () => {
    expect(parseCsv('﻿a,"b, c","say ""hi"""\r\n1,2,3\r\n')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });
});
