const isBlank = (cells: string[]) => cells.every((cell) => cell.trim() === "");

// Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF or LF. Bank exports quote
// descriptions that contain commas, so a plain split(",") is not enough.
export function parseCsv(text: string): string[][] {
  return allRows(text).filter((r) => !isBlank(r));
}

/** Non-blank rows with the row number a spreadsheet shows (blank rows still count). */
export function parseCsvNumbered(text: string): { cells: string[]; row: number }[] {
  return allRows(text)
    .map((cells, i) => ({ cells, row: i + 1 }))
    .filter((r) => !isBlank(r.cells));
}

function allRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, ""); // byte-order mark from spreadsheet exports

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
