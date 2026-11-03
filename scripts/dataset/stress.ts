import type { PaymentSource } from "@/core/schemas";
import type { DatasetLine } from "./scenarios";

// Day 4 stress set (06, "Stress cases for Day 4"). Kept apart from the October month so the
// 12 test cases and every earlier run stay comparable. Each case is built to hit one
// mechanism, and its expectation is *safe failure*: never a silent wrong value, a wrong
// pairing, or a rate of 1; always a named problem a person can act on. All names fictional.

export const STRESS_MONTH = "2026-10";

export type StressFile =
  | { kind: "pdf" }
  | { kind: "png" }
  | { kind: "photo"; width: number; height: number; angle: number; blur: number };

export interface StressReceipt {
  id: string;
  title: string;
  /** The 06 stress case this implements, in its words. */
  stress: string;
  file: StressFile;
  html: string;
  submitterId: string;
  paymentSource: PaymentSource;
  businessPurpose: string;
  truth: {
    isReceipt: boolean;
    vendor: string;
    date: string;
    total: number;
    currency: string;
    /** Statement lines that paid it: none, one, or two (S06). */
    lineIds: string[];
  };
  /** What the system must do, in plain words. The checks are in scripts/eval-stress.ts. */
  expect: string;
}

// ---------- HTML ----------

const BASE_CSS =
  "*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111}" +
  ".doc{width:380px;padding:22px 20px;font:14px/1.45 'Courier New',monospace}" +
  ".c{text-align:center}.b{font-weight:bold}.big{font-size:17px}" +
  ".row{display:flex;justify-content:space-between;gap:12px}" +
  ".rule{border-top:1px dashed #555;margin:8px 0}";

function page(css: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}${css}</style></head><body>${body}</body></html>`;
}

function till(opts: {
  header: string[];
  meta: string[];
  items: [string, string][];
  total: string;
  footer: string[];
}): string {
  const rows = (pairs: [string, string][]) =>
    pairs.map(([l, r]) => `<div class="row"><span>${l}</span><span>${r}</span></div>`).join("");
  return page(
    "",
    `<div class="doc">
${opts.header.map((h, i) => `<div class="c${i === 0 ? " b big" : ""}">${h}</div>`).join("")}
<div class="rule"></div>
${opts.meta.map((m) => `<div>${m}</div>`).join("")}
<div class="rule"></div>
${rows(opts.items)}
<div class="rule"></div>
<div class="row b big"><span>TOTAL</span><span>${opts.total}</span></div>
<div class="rule"></div>
${opts.footer.map((f) => `<div class="c">${f}</div>`).join("")}
</div>`,
  );
}

function invoice(opts: {
  from: string[];
  title: string;
  meta: [string, string][];
  items: [string, string][];
  totals: [string, string][];
  note?: string;
}): string {
  const css =
    ".doc{width:620px;padding:36px;font:14px/1.5 Helvetica,Arial,sans-serif}" +
    "h1{font-size:22px;margin:0 0 18px}table{width:100%;border-collapse:collapse;margin:14px 0}" +
    "td{padding:6px 0;border-bottom:1px solid #ddd}td:last-child{text-align:right}" +
    ".meta td{border:0;padding:2px 0}.tot td{border:0;font-weight:bold}.note{color:#444;margin-top:14px}";
  const table = (cls: string, pairs: [string, string][]) =>
    `<table class="${cls}">${pairs.map(([l, r]) => `<tr><td>${l}</td><td>${r}</td></tr>`).join("")}</table>`;
  return page(
    css,
    `<div class="doc">
<div class="b">${opts.from[0]}</div>${opts.from
      .slice(1)
      .map((l) => `<div>${l}</div>`)
      .join("")}
<h1 style="margin-top:22px">${opts.title}</h1>
${table("meta", opts.meta)}
${table("", opts.items)}
${table("tot", opts.totals)}
${opts.note ? `<div class="note">${opts.note}</div>` : ""}
</div>`,
  );
}

function chat(): string {
  const css =
    ".doc{width:420px;padding:16px;background:#eef1f4;font:15px/1.4 Helvetica,Arial,sans-serif}" +
    ".top{font-weight:bold;padding:4px 0 12px}.msg{max-width:78%;padding:9px 12px;border-radius:14px;margin:6px 0;background:#fff}" +
    ".me{margin-left:auto;background:#cfe6ff}.t{font-size:11px;color:#667;margin-top:3px}";
  const msg = (text: string, time: string, me = false) =>
    `<div class="msg${me ? " me" : ""}">${text}<div class="t">${time}</div></div>`;
  return page(
    css,
    `<div class="doc">
<div class="top">Team chat · #office</div>
${msg("Hey, can you pay the Sample Supplies invoice? It's $45 for the printer paper.", "9:12 am")}
${msg("Sure, I'll put it on the card this afternoon", "9:15 am", true)}
${msg("Thanks! Receipt should come by email", "9:16 am")}
${msg("👍", "9:16 am", true)}
</div>`,
  );
}

// ---------- the cases ----------

export const STRESS_RECEIPTS: StressReceipt[] = [
  {
    id: "S01",
    title: "Unreadable photo, 400 px",
    stress: "an unreadable photo (heavy blur, 400 px)",
    file: { kind: "photo", width: 300, height: 400, angle: 6, blur: 3 },
    html: till({
      header: [
        "QUAYSIDE ESPRESSO",
        "4 Example Wharf",
        "Sample City NSW 2000",
        "ABN 12 345 678 901",
      ],
      meta: ["TAX INVOICE", "06/10/2026 08:14"],
      items: [
        ["Long black", "$5.20"],
        ["Bircher muesli", "$13.00"],
      ],
      total: "$18.20",
      footer: ["GST included $1.65", "Visa ****4821 APPROVED"],
    }),
    submitterId: "staff-a",
    paymentSource: "company_card",
    businessPurpose: "Breakfast before the client workshop",
    truth: {
      isReceipt: true,
      vendor: "Quayside Espresso",
      date: "2026-10-06",
      total: 18.2,
      currency: "AUD",
      lineIds: ["L03"],
    },
    expect:
      "Stopped at the quality gate (R-QUA-1) with the measured size and a fix; never sent to the model; not matched; out of totals.",
  },
  {
    id: "S02",
    title: "Heavy blur at full size",
    stress: "an unreadable photo (heavy blur), at a size that passes the gate",
    file: { kind: "photo", width: 900, height: 1200, angle: -5, blur: 7 },
    html: till({
      header: [
        "LANTERN STREET CAFE",
        "22 Lantern Street",
        "Sample City NSW 2000",
        "ABN 98 765 432 109",
      ],
      meta: ["TAX INVOICE", "07/10/2026 12:41", "Table 6"],
      items: [
        ["Chicken salad", "$19.50"],
        ["Iced latte", "$7.30"],
        ["Sparkling water", "$10.00"],
      ],
      total: "$36.80",
      footer: ["GST included $3.35", "Visa ****4821 APPROVED"],
    }),
    submitterId: "staff-b",
    paymentSource: "company_card",
    businessPurpose: "Lunch with a supplier",
    truth: {
      isReceipt: true,
      vendor: "Lantern Street Cafe",
      date: "2026-10-07",
      total: 36.8,
      currency: "AUD",
      lineIds: ["L04"],
    },
    expect:
      "Either read correctly, or every doubtful field is flagged (LOW_CONFIDENCE_FIELD or UNREADABLE). Never a wrong total, date, or currency with high confidence that a person could bulk-approve.",
  },
  {
    id: "S03",
    title: "Chat screenshot",
    stress: "a non-receipt image (a screenshot of a chat)",
    file: { kind: "png" },
    html: chat(),
    submitterId: "staff-c",
    paymentSource: "company_card",
    businessPurpose: "Printer paper",
    truth: {
      isReceipt: false,
      vendor: "",
      date: "2026-10-08",
      total: 45,
      currency: "AUD",
      lineIds: [],
    },
    expect:
      "NOT_A_RECEIPT (R-QUA-4), in the first queue group; it must not take the $45.00 Sample Supplies line, which stays listed as a line with no receipt.",
  },
  {
    id: "S04",
    title: "Bare $ with no currency clues",
    stress: '"$" with no currency clues',
    file: { kind: "pdf" },
    html: till({
      header: ["KETTLE &amp; CRUMB"],
      meta: ["09/10/2026 15:02", "Order 2291"],
      items: [
        ["Scone + jam", "$9.00"],
        ["Pot of tea x2", "$15.00"],
      ],
      total: "$24.00",
      footer: ["Card APPROVED", "Thanks for visiting"],
    }),
    submitterId: "staff-a",
    paymentSource: "company_card",
    businessPurpose: "Afternoon tea with a new hire",
    truth: {
      isReceipt: true,
      vendor: "Kettle & Crumb",
      date: "2026-10-09",
      total: 24,
      currency: "AUD",
      lineIds: ["L06"],
    },
    expect:
      "Currency flagged for a person (R-CUR-5: never assumed to be AUD without evidence), so it is not bulk-approvable. No address, ABN, GST, or currency code is printed.",
  },
  {
    id: "S05",
    title: "Ambiguous numeric date from a US vendor",
    stress: "a date in ambiguous 03/04/2026 format",
    file: { kind: "pdf" },
    html: invoice({
      from: ["Fernway Analytics Inc.", "200 Sample Boulevard", "Example City, TX 75000, USA"],
      title: "Invoice",
      meta: [
        ["Invoice number", "FW-30417"],
        ["Invoice date", "10/09/2026"],
        ["Billed to", "Example Holdings Pty Ltd"],
      ],
      items: [["Analytics seat, monthly", "$29.00"]],
      totals: [
        ["Total (USD)", "$29.00"],
        ["Paid", "$29.00"],
      ],
      note: "Paid by card ending 4821. Thank you for your business.",
    }),
    submitterId: "staff-b",
    paymentSource: "company_card",
    businessPurpose: "Product analytics for the website",
    truth: {
      isReceipt: true,
      vendor: "Fernway Analytics Inc.",
      date: "2026-10-09",
      total: 29,
      currency: "USD",
      lineIds: ["L07"],
    },
    expect:
      "The printed 10/09/2026 is month-first (a US invoice: 9 October). Read as 2026-10-09, or the date flagged low-confidence. Never 2026-09-10 with high confidence.",
  },
  {
    id: "S06",
    title: "One receipt, two payments",
    stress: "a receipt covering two items paid in two transactions",
    file: { kind: "pdf" },
    html: invoice({
      from: ["Example Bay Lodge", "9 Shoreline Drive, Example Bay VIC 3000", "ABN 31 415 926 535"],
      title: "Tax invoice",
      meta: [
        ["Invoice", "EBL-7781"],
        ["Date", "3 October 2026"],
        ["Stay", "1 to 3 October 2026 (2 nights)"],
      ],
      items: [
        ["Room, 2 nights", "$560.00"],
        ["Conference room hire, half day", "$60.00"],
      ],
      totals: [
        ["Total (incl. GST $56.36)", "$620.00"],
        ["Deposit paid 1 October 2026", "$200.00"],
        ["Balance paid 3 October 2026", "$420.00"],
        ["Amount due", "$0.00"],
      ],
      note: "All amounts in AUD.",
    }),
    submitterId: "staff-c",
    paymentSource: "company_card",
    businessPurpose: "Accommodation and room hire for the regional sales visit",
    truth: {
      isReceipt: true,
      vendor: "Example Bay Lodge",
      date: "2026-10-03",
      total: 620,
      currency: "AUD",
      lineIds: ["L01", "L02"],
    },
    expect:
      "Never auto-paired with either part payment (each is far from $620). It goes to a person, and both lines stay visible, so the $620 is not lost or counted twice.",
  },
  {
    id: "S07",
    title: "Purchase later refunded",
    stress: "a refund (a negative statement line)",
    file: { kind: "pdf" },
    html: till({
      header: ["TOOLHAUS HARDWARE", "55 Sample Road", "Example Bay VIC 3000", "ABN 27 182 818 284"],
      meta: ["TAX INVOICE", "12/10/2026 10:05", "Docket TH-55120"],
      items: [
        ["Cordless drill kit", "$49.00"],
        ["Drill bit set", "$15.00"],
      ],
      total: "$64.00",
      footer: ["GST included $5.82", "Visa ****4821 APPROVED"],
    }),
    submitterId: "staff-a",
    paymentSource: "company_card",
    businessPurpose: "Tools to mount the meeting-room screen",
    truth: {
      isReceipt: true,
      vendor: "Toolhaus Hardware",
      date: "2026-10-12",
      total: 64,
      currency: "AUD",
      lineIds: ["L08"],
    },
    expect:
      "Matched to the $64.00 purchase. The −$64.00 refund three days later is never offered as a payment for any receipt; it is listed as a credit for a person to record.",
  },
  {
    id: "S08",
    title: "Only the refund is on the statement",
    stress: "a refund (a negative statement line), with no purchase line",
    file: { kind: "pdf" },
    html: till({
      header: [
        "PAPERLEAF STATIONERS",
        "12 Example Arcade",
        "Sample City NSW 2000",
        "ABN 16 180 339 887",
      ],
      meta: ["TAX INVOICE", "20/10/2026 16:22"],
      items: [
        ["A4 notebooks x5", "$22.50"],
        ["Gel pens, box", "$16.00"],
      ],
      total: "$38.50",
      footer: ["GST included $3.50", "Visa ****4821 APPROVED"],
    }),
    submitterId: "staff-b",
    paymentSource: "company_card",
    businessPurpose: "Notebooks for the onboarding packs",
    truth: {
      isReceipt: true,
      vendor: "Paperleaf Stationers",
      date: "2026-10-20",
      total: 38.5,
      currency: "AUD",
      lineIds: [],
    },
    expect:
      "The purchase is not on this statement, only a −$38.50 refund two days later. NO_PAYMENT_FOUND; the refund is never offered as the payment (choosing it would put a negative amount in the ledger as if paid).",
  },
];

/** The stress statement, format A, in file order (so readStatement gives these ids). */
export const STRESS_LINES: DatasetLine[] = [
  {
    id: "L01",
    date: "2026-10-01",
    description: "EXAMPLE BAY LODGE EXAMPLE BAY AU",
    amountAud: 200,
    account: "company_card",
    receiptId: "S06",
    note: "Deposit: part of S06's $620",
  },
  {
    id: "L02",
    date: "2026-10-03",
    description: "EXAMPLE BAY LODGE EXAMPLE BAY AU",
    amountAud: 420,
    account: "company_card",
    receiptId: "S06",
    note: "Balance: the rest of S06's $620",
  },
  {
    id: "L03",
    date: "2026-10-06",
    description: "SQ *QUAYSIDE ESPRESSO SAMPLE CITY AU",
    amountAud: 18.2,
    account: "company_card",
    receiptId: "S01",
  },
  {
    id: "L04",
    date: "2026-10-07",
    description: "LANTERN STREET CAFE SAMPLE CITY AU",
    amountAud: 36.8,
    account: "company_card",
    receiptId: "S02",
  },
  {
    id: "L05",
    date: "2026-10-08",
    description: "SAMPLE SUPPLIES PTY LTD",
    amountAud: 45,
    account: "company_card",
    receiptId: null,
    note: "The payment the chat (S03) talks about; its real receipt was never uploaded",
  },
  {
    id: "L06",
    date: "2026-10-09",
    description: "KETTLE AND CRUMB SAMPLE CITY AU",
    amountAud: 24,
    account: "company_card",
    receiptId: "S04",
  },
  {
    id: "L07",
    date: "2026-10-10",
    description: "FERNWAY ANALYTICS INC EXAMPLE CITY US",
    amountAud: 45.33,
    originalAmount: { amount: 29, currency: "USD" },
    account: "company_card",
    receiptId: "S05",
  },
  {
    id: "L08",
    date: "2026-10-12",
    description: "TOOLHAUS HARDWARE EXAMPLE BAY AU",
    amountAud: 64,
    account: "company_card",
    receiptId: "S07",
  },
  {
    id: "L09",
    date: "2026-10-15",
    description: "TOOLHAUS HARDWARE EXAMPLE BAY AU",
    amountAud: -64,
    account: "company_card",
    receiptId: null,
    note: "Refund of S07's purchase (a credit)",
  },
  {
    id: "L10",
    date: "2026-10-22",
    description: "PAPERLEAF STATIONERS SAMPLE CITY AU",
    amountAud: -38.5,
    account: "company_card",
    receiptId: null,
    note: "Refund of S08's purchase, which was charged elsewhere (a credit)",
  },
];
