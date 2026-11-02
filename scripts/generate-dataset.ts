import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { DEFAULT_CATEGORIES } from "@/core/schemas";
import { toPhonePhoto } from "./dataset/degrade";
import { buildDataset, type DatasetReceipt } from "./dataset/scenarios";
import { BaselineSubset, GroundTruth, Intake, type IntakeReceipt, Splits } from "./dataset/schema";
import { toFormatA, toFormatB } from "./dataset/statement-csv";
import { renderHtml } from "./dataset/templates";

// Usage: pnpm dataset
// Regenerates fixtures/dataset from scripts/dataset/scenarios.ts. Needs Chromium once:
// pnpm exec playwright install chromium

const OUT = join(import.meta.dirname, "..", "fixtures", "dataset");
const RECEIPTS_DIR = join(OUT, "receipts");
const KIT_DIR = join(OUT, "baseline", "b0-kit");

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

// Chromium stamps each PDF with the current time, so every rerun changed every hash.
// Pin the timestamps to a fixed value of the same length so xref byte offsets stay valid.
function stabilisePdf(pdf: Buffer): Buffer {
  const text = pdf.toString("latin1").replace(/D:\d{14}/g, "D:20261101000000");
  return Buffer.from(text, "latin1");
}

async function renderAll(receipts: DatasetReceipt[]) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      deviceScaleFactor: 2,
      viewport: { width: 900, height: 1200 },
    });
    for (const r of receipts) {
      const target = join(RECEIPTS_DIR, r.fileName);
      if (r.duplicate?.mode === "exact") {
        const original = receipts.find((o) => o.id === r.duplicate?.of);
        if (!original) throw new Error(`${r.id}: original ${r.duplicate.of} not found`);
        copyFileSync(join(RECEIPTS_DIR, original.fileName), target);
        continue;
      }
      await page.setContent(renderHtml(r), { waitUntil: "load" });
      const doc = page.locator(".doc");
      if (r.fileKind === "pdf") {
        const box = await doc.boundingBox();
        if (!box) throw new Error(`${r.id}: nothing rendered`);
        const pdf = await page.pdf({
          width: `${Math.ceil(box.width)}px`,
          height: `${Math.ceil(box.height)}px`,
          printBackground: true,
          pageRanges: "1",
        });
        writeFileSync(target, stabilisePdf(pdf));
      } else if (r.fileKind === "png") {
        writeFileSync(target, await doc.screenshot({ type: "png" }));
      } else {
        if (!r.photo) throw new Error(`${r.id}: photo settings missing`);
        const clean = await doc.screenshot({ type: "png" });
        writeFileSync(target, await toPhonePhoto(clean, r.photo));
      }
      process.stdout.write(".");
    }
    process.stdout.write("\n");
  } finally {
    await browser.close();
  }
}

async function intakeFile(r: DatasetReceipt): Promise<IntakeReceipt["file"]> {
  const path = join(RECEIPTS_DIR, r.fileName);
  const file: IntakeReceipt["file"] = {
    path: `receipts/${r.fileName}`,
    mime: r.mime,
    sha256: sha256(path),
  };
  if (r.mime !== "application/pdf") {
    const meta = await sharp(path).metadata();
    if (meta.width) file.width = meta.width;
    if (meta.height) file.height = meta.height;
  }
  return file;
}

function writeB0Kit(
  receipts: DatasetReceipt[],
  intake: IntakeReceipt[],
  subset: BaselineSubset,
  statementCsvWithIds: string,
) {
  mkdirSync(join(KIT_DIR, "receipts"), { recursive: true });
  const chosen = receipts.filter((r) => subset.receiptIds.includes(r.id));
  for (const r of chosen) {
    copyFileSync(join(RECEIPTS_DIR, r.fileName), join(KIT_DIR, "receipts", r.fileName));
  }
  const quote = (s: string) => `"${s.replaceAll('"', '""')}"`;
  const intakeRows = intake
    .filter((i) => subset.receiptIds.includes(i.id))
    .map((i) =>
      [
        i.id,
        i.file.path.replace("receipts/", ""),
        i.submitterId,
        i.paymentSource,
        quote(i.businessPurpose ?? ""),
      ].join(","),
    );
  writeFileSync(
    join(KIT_DIR, "receipts.csv"),
    `Receipt,File,Submitted by,Paid with,Business purpose\r\n${intakeRows.join("\r\n")}\r\n`,
  );
  writeFileSync(join(KIT_DIR, "statement.csv"), statementCsvWithIds);
  writeFileSync(
    join(KIT_DIR, "answer-sheet.csv"),
    `Receipt,Category,Statement line,Flags,Notes\r\n${subset.receiptIds.map((id) => `${id},,,,`).join("\r\n")}\r\n`,
  );
  writeFileSync(
    join(KIT_DIR, "INSTRUCTIONS.md"),
    `# Month-end check: 20 receipts

Work the way you normally would. There is no trick and no time pressure; we only want to see how long the normal process takes.

You have:

- \`receipts/\`: the 20 receipt files
- \`receipts.csv\`: who submitted each one, how it was paid, and the business purpose they gave
- \`statement.csv\`: the card and bank statement for October 2026 (each row has a Line number)

For each receipt, fill one row of \`answer-sheet.csv\`:

| Column | What to write |
|---|---|
| Category | One of: ${DEFAULT_CATEGORIES.join(", ")} |
| Statement line | The Line number that paid for it, or "none" |
| Flags | Anything you would query, chase, or need signed off, in your own words. Leave blank if it is fine. |
| Notes | Optional |

Say "done" when you would be happy to sign off the month.
`,
  );
}

async function main() {
  const ds = buildDataset();

  rmSync(RECEIPTS_DIR, { recursive: true, force: true });
  rmSync(join(OUT, "baseline"), { recursive: true, force: true });
  mkdirSync(RECEIPTS_DIR, { recursive: true });

  console.log(`Rendering ${ds.receipts.length} receipts`);
  await renderAll(ds.receipts);

  const intake: IntakeReceipt[] = [];
  for (const r of ds.receipts) intake.push({ ...r.intake, file: await intakeFile(r) });

  const groundTruth = GroundTruth.parse({
    monthKey: ds.monthKey,
    generatedBy: "scripts/generate-dataset.ts",
    seed: ds.seed,
    receipts: ds.receipts.map((r) => r.truth),
    statementLines: ds.statementLines,
  });

  writeJson(join(OUT, "receipts.json"), Intake.parse({ monthKey: ds.monthKey, receipts: intake }));
  writeJson(join(OUT, "ground-truth.json"), groundTruth);
  writeJson(join(OUT, "splits.json"), Splits.parse(ds.splits));
  writeJson(join(OUT, "baseline-subset.json"), BaselineSubset.parse(ds.baselineSubset));
  writeFileSync(join(OUT, "statement-format-a.csv"), toFormatA(ds.statementLines));
  writeFileSync(join(OUT, "statement-format-b.csv"), toFormatB(ds.statementLines));
  writeB0Kit(ds.receipts, intake, ds.baselineSubset, toFormatA(ds.statementLines, true));

  const photos = ds.receipts.filter((r) => r.fileKind === "photo").length;
  console.log(
    `Wrote ${ds.receipts.length} receipts (${photos} phone photos), ${ds.statementLines.length} statement lines, ` +
      `splits ${ds.splits.tuning.length}/${ds.splits.holdout.length}, B0 kit of ${ds.baselineSubset.receiptIds.length}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
