import type { ExceptionCode } from "@/core/schemas";
import type { Prediction } from "./score";

// Turns a human or chat-assistant answer table (markdown) into Predictions.
// Free-text flags are coded by fixed keyword rules so the coding is repeatable;
// only the Flags column is coded, because that is what a reviewer acts on.

const FLAG_RULES: { code: ExceptionCode; pattern: RegExp }[] = [
  { code: "MISSING_PURPOSE", pattern: /purpose/i },
  { code: "DUPLICATE", pattern: /duplicate receipt/i },
  {
    code: "AMBIGUOUS_MATCH",
    pattern: /duplicate (bank |card )?charge|ambiguous|which (line|charge)/i,
  },
  {
    code: "AMOUNT_DIFFERS_OVER_THRESHOLD",
    pattern: /amount|discrepanc|mismatch|sign-off|approval required/i,
  },
  {
    code: "NO_PAYMENT_FOUND",
    pattern:
      /no (matching )?(payment|charge|statement line)|not on (the )?statement|payment not found/i,
  },
];

export function codeFlags(text: string): ExceptionCode[] {
  return FLAG_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.code);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim().replace(/\\(.)/g, "$1"));
}

export interface AnswerRow {
  cells: Record<string, string>;
  prediction: Prediction;
  tentativeLine: boolean;
}

export function parseAnswerTable(markdown: string): AnswerRow[] {
  const lines = markdown.split(/\r?\n/).filter((l) => l.trim().startsWith("|"));
  const [headerLine, , ...body] = lines;
  if (!headerLine) throw new Error("No table found");
  const header = splitRow(headerLine).map((h) => h.toLowerCase());

  return body.map((line) => {
    const values = splitRow(line);
    const cells = Object.fromEntries(header.map((h, i) => [h, values[i] ?? ""]));
    const get = (name: string) => cells[name]?.trim() ?? "";
    const lineText = get("statement line");
    const lineId = /\bL\d+\b/i.exec(lineText)?.[0]?.toUpperCase() ?? null;
    const total = Number.parseFloat(get("total").replace(/[^0-9.-]/g, ""));
    return {
      cells,
      tentativeLine: /tentative|possible|\?/i.test(lineText),
      prediction: {
        receiptId: get("receipt").toUpperCase(),
        vendor: get("vendor") || null,
        date: get("date") || null,
        total: Number.isFinite(total) ? total : null,
        currency: get("currency") || null,
        category: get("category") || null,
        statementLineId: lineId,
        exceptions: codeFlags(get("flags")),
      },
    };
  });
}
