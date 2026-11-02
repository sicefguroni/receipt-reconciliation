import type { DatasetReceipt, Layout } from "./scenarios";

// HTML receipt templates, one per layout. Each prints dates and currency the way
// that kind of document does in practice, so extraction has to cope with variety.

const BILL_TO = "Example Holdings Pty Ltd";
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function esc(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function num(cents: number): string {
  return (cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) throw new Error(`Bad date ${iso}`);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "";
  const month = MONTHS[m - 1] ?? "";
  return {
    y,
    m,
    d,
    weekday,
    month,
    dd: String(d).padStart(2, "0"),
    mm: String(m).padStart(2, "0"),
  };
}

const dateStyles = {
  slashes: (iso: string) => {
    const p = parts(iso);
    return `${p.dd}/${p.mm}/${p.y}`;
  },
  slashesShort: (iso: string) => {
    const p = parts(iso);
    return `${p.dd}/${p.mm}/${String(p.y).slice(2)}`;
  },
  airline: (iso: string) => {
    const p = parts(iso);
    return `${p.dd} ${p.month.slice(0, 3).toUpperCase()} ${p.y}`;
  },
  us: (iso: string) => {
    const p = parts(iso);
    return `${p.month} ${p.d}, ${p.y}`;
  },
  au: (iso: string) => {
    const p = parts(iso);
    return `${p.d} ${p.month} ${p.y}`;
  },
  eu: (iso: string) => {
    const p = parts(iso);
    return `${p.dd}.${p.mm}.${p.y}`;
  },
  long: (iso: string) => {
    const p = parts(iso);
    return `${p.weekday} ${p.d} ${p.month} ${p.y}`;
  },
};

function page(title: string, css: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111}${css}</style>
</head><body>${body}</body></html>`;
}

function cafe(r: DatasetReceipt): string {
  const v = r.vendor;
  const rows = r.items
    .map(
      (i) =>
        `<div class="row"><span>${esc(i.description)}</span><span>${num(i.cents)}</span></div>`,
    )
    .join("");
  const ref = v.name.includes("Taxi") ? `Trip ${r.docNumber}` : `Order #${r.docNumber}`;
  const body = `<div class="doc">
  <div class="c b big">${esc(v.name.toUpperCase())}</div>
  ${v.address.map((a) => `<div class="c">${esc(a)}</div>`).join("")}
  ${v.abn ? `<div class="c">ABN ${esc(v.abn)}</div>` : ""}
  ${v.phone ? `<div class="c">Ph ${esc(v.phone)}</div>` : ""}
  <div class="rule"></div>
  <div class="c b">TAX INVOICE</div>
  <div class="row"><span>${dateStyles.slashes(r.date)}</span><span>${r.time}</span></div>
  <div>${esc(ref)}</div>
  <div class="rule"></div>
  ${rows}
  <div class="rule"></div>
  <div class="row b big"><span>TOTAL</span><span>$${num(r.totalCents)}</span></div>
  ${r.taxCents === null ? "" : `<div class="row"><span>GST included</span><span>$${num(r.taxCents)}</span></div>`}
  <div class="rule"></div>
  <div class="row"><span>${esc(r.paymentLine)}</span><span>APPROVED</span></div>
  <div class="row"><span>PURCHASE</span><span>$${num(r.totalCents)}</span></div>
  <div class="rule"></div>
  <div class="c">Thank you, see you again!</div>
</div>`;
  return page(
    `${v.name} ${r.docNumber}`,
    `.doc{width:300px;padding:18px 16px 28px;font:13px/1.45 "Courier New",monospace}
.c{text-align:center}.b{font-weight:bold}.big{font-size:15px}
.row{display:flex;justify-content:space-between;gap:8px}
.rule{border-top:1px dashed #333;margin:8px 0}`,
    body,
  );
}

function hardware(r: DatasetReceipt): string {
  const v = r.vendor;
  const rows = r.items
    .map(
      (i, idx) =>
        `<tr><td>${100000 + idx * 137 + (r.totalCents % 997)}</td><td>1</td><td>${esc(i.description)}</td><td class="r">${num(i.cents)}</td></tr>`,
    )
    .join("");
  const body = `<div class="doc">
  <div class="name">${esc(v.name)}</div>
  ${v.address.map((a) => `<div>${esc(a)}</div>`).join("")}
  <div>ABN ${esc(v.abn ?? "")}${v.phone ? ` &middot; ${esc(v.phone)}` : ""}</div>
  <div class="title">TAX INVOICE ${esc(r.docNumber)}</div>
  <div>Date: ${dateStyles.slashesShort(r.date)} ${r.time}</div>
  <div>Customer: ${BILL_TO}</div>
  <table><thead><tr><th>Item</th><th>Qty</th><th>Description</th><th class="r">Price</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="sum"><span>Subtotal (incl. GST)</span><span>$${num(r.totalCents)}</span></div>
  <div class="sum"><span>GST</span><span>$${num(r.taxCents ?? 0)}</span></div>
  <div class="sum total"><span>TOTAL AUD</span><span>$${num(r.totalCents)}</span></div>
  <div class="pay">Paid: ${esc(r.paymentLine)}</div>
  <div class="small">Keep this receipt for returns within 30 days.</div>
</div>`;
  return page(
    `${v.name} ${r.docNumber}`,
    `.doc{width:360px;padding:18px;font:12px/1.4 Arial,sans-serif}
.name{font-size:20px;font-weight:bold;letter-spacing:.5px}
.title{margin:10px 0 4px;font-weight:bold;font-size:14px}
table{width:100%;border-collapse:collapse;margin:10px 0}
th,td{text-align:left;padding:3px 2px;border-bottom:1px solid #ccc;vertical-align:top}
.r{text-align:right}.sum{display:flex;justify-content:space-between}
.total{font-weight:bold;font-size:15px;border-top:2px solid #111;margin-top:4px;padding-top:4px}
.pay{margin-top:10px}.small{margin-top:12px;font-size:10px;color:#555}`,
    body,
  );
}

function airline(r: DatasetReceipt): string {
  const v = r.vendor;
  const rows = r.items
    .map((i) => `<tr><td>${esc(i.description)}</td><td class="r">${num(i.cents)}</td></tr>`)
    .join("");
  const body = `<div class="doc">
  <div class="bar">${esc(v.name.toUpperCase())}</div>
  <h1>Tax Invoice / Receipt</h1>
  <table class="meta">
    <tr><td>Booking reference</td><td>${esc(r.docNumber)}</td></tr>
    <tr><td>Date of issue</td><td>${dateStyles.airline(r.date)}</td></tr>
    <tr><td>Passenger</td><td>TRAVELLER / ${BILL_TO.toUpperCase()}</td></tr>
    <tr><td>ABN</td><td>${esc(v.abn ?? "")}</td></tr>
  </table>
  <table class="lines"><thead><tr><th>Description</th><th class="r">AUD</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="total">Total paid: AUD ${num(r.totalCents)}</p>
  <p>Includes GST of AUD ${num(r.taxCents ?? 0)}</p>
  <p>Form of payment: ${esc(r.paymentLine)}</p>
  <p class="small">${esc(v.address.join(", "))}. Fares are subject to the conditions of carriage.</p>
</div>`;
  return page(
    `${v.name} ${r.docNumber}`,
    `.doc{width:794px;min-height:1123px;padding:56px 64px;font:14px/1.5 Arial,sans-serif}
.bar{background:#0b4f8a;color:#fff;font-weight:bold;font-size:22px;padding:14px 20px;letter-spacing:2px}
h1{font-size:20px;margin:28px 0 12px}
table{border-collapse:collapse}.meta td{padding:3px 24px 3px 0}
.lines{width:100%;margin-top:24px}.lines th,.lines td{border-bottom:1px solid #ccc;padding:8px 4px;text-align:left}
.r{text-align:right!important}.total{font-size:18px;font-weight:bold;margin-top:24px}
.small{margin-top:80px;font-size:11px;color:#666}`,
    body,
  );
}

function invoice(r: DatasetReceipt): string {
  const v = r.vendor;
  const dateText =
    v.locale === "us"
      ? dateStyles.us(r.date)
      : v.locale === "eu"
        ? dateStyles.eu(r.date)
        : dateStyles.au(r.date);
  const money = (cents: number) =>
    v.locale === "us"
      ? `$${num(cents)} USD`
      : v.locale === "eu" || r.currency !== "AUD"
        ? `${r.currency} ${num(cents)}`
        : `$${num(cents)}`;
  const taxRow =
    r.taxCents !== null
      ? `<tr><td>GST included</td><td class="r">${money(r.taxCents)}</td></tr>`
      : v.locale === "eu"
        ? `<tr><td>VAT (reverse charge)</td><td class="r">${money(0)}</td></tr>`
        : `<tr><td>Tax</td><td class="r">${money(0)}</td></tr>`;
  const rows = r.items
    .map((i) => `<tr><td>${esc(i.description)}</td><td class="r">${money(i.cents)}</td></tr>`)
    .join("");
  const body = `<div class="doc">
  <div class="head">
    <div><div class="name">${esc(v.name)}</div>${v.address.map((a) => `<div>${esc(a)}</div>`).join("")}${v.abn ? `<div>ABN ${esc(v.abn)}</div>` : ""}</div>
    <div class="right"><div class="title">${r.taxCents !== null ? "TAX INVOICE" : "INVOICE"}</div>
      <div>Invoice no. ${esc(r.docNumber)}</div><div>Date of issue: ${dateText}</div><div class="paid">PAID</div></div>
  </div>
  <div class="bill"><b>Bill to</b><br>${BILL_TO}<br>Sample City NSW 2000, Australia</div>
  ${v.locale === "au" ? `<div class="note">All amounts in AUD</div>` : ""}
  <table class="lines"><thead><tr><th>Description</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <table class="totals">
    <tr><td>Subtotal</td><td class="r">${money(r.totalCents - (r.taxCents ?? 0))}</td></tr>
    ${taxRow}
    <tr class="grand"><td>Total</td><td class="r">${money(r.totalCents)}</td></tr>
    <tr><td>Amount paid</td><td class="r">${money(r.totalCents)}</td></tr>
  </table>
  <p>Payment: ${esc(r.paymentLine)} on ${dateText}</p>
</div>`;
  return page(
    `${v.name} ${r.docNumber}`,
    `.doc{width:794px;min-height:1123px;padding:56px 64px;font:13px/1.5 Helvetica,Arial,sans-serif}
.head{display:flex;justify-content:space-between}.name{font-size:20px;font-weight:bold;margin-bottom:4px}
.right{text-align:right}.title{font-size:24px;font-weight:bold;letter-spacing:1px;margin-bottom:6px}
.paid{display:inline-block;margin-top:8px;border:2px solid #1a7f37;color:#1a7f37;padding:2px 10px;font-weight:bold}
.bill{margin:36px 0 18px}.note{color:#555;margin-bottom:8px}
.lines{width:100%;border-collapse:collapse}.lines th{background:#f0f0f0;text-align:left;padding:8px}
.lines td{padding:8px;border-bottom:1px solid #ddd}.r{text-align:right!important}
.totals{margin:18px 0 0 auto;border-collapse:collapse;min-width:300px}.totals td{padding:4px 8px}
.grand td{font-weight:bold;font-size:15px;border-top:2px solid #111}`,
    body,
  );
}

function adplatform(r: DatasetReceipt): string {
  const v = r.vendor;
  const rows = r.items
    .map((i) => `<tr><td>${esc(i.description)}</td><td class="r">A$${num(i.cents)}</td></tr>`)
    .join("");
  const body = `<div class="doc">
  <div class="logo">brightreach<span>ads</span></div>
  <h1>Tax invoice</h1>
  <table class="meta">
    <tr><td>Invoice number</td><td>${esc(r.docNumber)}</td></tr>
    <tr><td>Invoice date</td><td>${r.date}</td></tr>
    <tr><td>Ad account</td><td>${BILL_TO} (acct 402-118-7731)</td></tr>
    <tr><td>Billing reason</td><td>Payment threshold reached</td></tr>
  </table>
  <table class="lines"><thead><tr><th>Campaign</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="total">Total charged: A$${num(r.totalCents)}</p>
  <p>GST included: A$${num(r.taxCents ?? 0)}</p>
  <p>Charged to ${esc(r.paymentLine)}</p>
  <p class="small">${esc(v.name)} &middot; ABN ${esc(v.abn ?? "")} &middot; ${esc(v.address.join(", "))}</p>
</div>`;
  return page(
    `${v.name} ${r.docNumber}`,
    `.doc{width:794px;min-height:1123px;padding:56px 64px;font:13px/1.55 Arial,sans-serif;color:#1d1d1f}
.logo{font-size:26px;font-weight:bold;color:#6b2bd9}.logo span{color:#1d1d1f;font-weight:normal;margin-left:2px}
h1{font-size:22px;margin:30px 0 10px}.meta td{padding:3px 28px 3px 0;color:#333}
.lines{width:100%;border-collapse:collapse;margin-top:24px}.lines th{text-align:left;border-bottom:2px solid #6b2bd9;padding:8px 4px}
.lines td{padding:8px 4px;border-bottom:1px solid #e3e3e3}.r{text-align:right!important}
.total{font-size:18px;font-weight:bold;margin-top:22px}.small{margin-top:60px;font-size:11px;color:#777}`,
    body,
  );
}

function coworking(r: DatasetReceipt): string {
  const v = r.vendor;
  const rows = r.items
    .map(
      (i) =>
        `<div class="row"><span>${esc(i.description)}</span><span>$${num(i.cents)}</span></div>`,
    )
    .join("");
  const body = `<div class="doc"><div class="card">
  <div class="name">${esc(v.name)}</div>
  <div class="muted">${esc(v.address.join(", "))} &middot; ABN ${esc(v.abn ?? "")}</div>
  <h1>Receipt ${esc(r.docNumber)}</h1>
  <div class="muted">${dateStyles.long(r.date)} at ${r.time}</div>
  <div class="items">${rows}</div>
  <div class="row total"><span>Total paid</span><span>$${num(r.totalCents)}</span></div>
  <div class="row muted"><span>Includes GST</span><span>$${num(r.taxCents ?? 0)}</span></div>
  <div class="muted pay">${esc(r.paymentLine)} &middot; Member: ${BILL_TO}</div>
</div></div>`;
  return page(
    `${v.name} ${r.docNumber}`,
    `.doc{width:520px;padding:28px;background:#f4f1ea;font:14px/1.5 Georgia,serif}
.card{background:#fff;border-radius:10px;padding:28px;border:1px solid #e2dccf}
.name{font-size:22px;font-weight:bold;color:#2f5d50}.muted{color:#666;font-size:12px}
h1{font-size:17px;margin:20px 0 2px}.items{margin:18px 0;border-top:1px solid #eee}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}
.total{font-weight:bold;font-size:16px;border-bottom:none}.pay{margin-top:14px}`,
    body,
  );
}

const LAYOUTS: Record<Layout, (r: DatasetReceipt) => string> = {
  cafe,
  hardware,
  airline,
  invoice,
  adplatform,
  coworking,
};

export function renderHtml(r: DatasetReceipt): string {
  return LAYOUTS[r.layout](r);
}
