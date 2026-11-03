import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { createRng } from "./dataset/rng";
import { GroundTruth, Intake, type IntakeReceipt } from "./dataset/schema";
import { toFormatA } from "./dataset/statement-csv";
import { STRESS_LINES, STRESS_MONTH, STRESS_RECEIPTS, type StressFile } from "./dataset/stress";

// Usage: pnpm dataset:stress
// Writes fixtures/stress from scripts/dataset/stress.ts: the stress receipts, their statement,
// and a copy of the October statement with an extra header row and ISO dates (06 stress case).
// The October dataset is not touched.

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "fixtures", "stress");
const RECEIPTS_DIR = join(OUT, "receipts");
const TABLE = { r: 138, g: 128, b: 116 };

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

// Same timestamp pinning as the October generator, so a rerun gives identical PDFs.
function stabilisePdf(pdf: Buffer): Buffer {
  return Buffer.from(pdf.toString("latin1").replace(/D:\d{14}/g, "D:20261101000000"), "latin1");
}

/** A phone photo degraded past what the October set uses: stronger blur, optionally tiny. */
async function degrade(png: Buffer, f: Extract<StressFile, { kind: "photo" }>, seed: number) {
  const { data, info } = await sharp(
    await sharp(png)
      .flatten({ background: "#ffffff" })
      .rotate(f.angle, { background: TABLE })
      .toBuffer(),
  )
    .resize(f.width, f.height, { fit: "contain", background: TABLE })
    .modulate({ brightness: 0.9 })
    .blur(f.blur)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rng = createRng(seed);
  for (let i = 0; i < data.length; i++) {
    const noise = (rng() + rng() + rng() - 1.5) * 20;
    data[i] = Math.max(0, Math.min(255, Math.round((data[i] ?? 0) + noise)));
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .jpeg({ quality: 55 })
    .toBuffer();
}

const EXT = { pdf: "pdf", png: "png", photo: "jpg" } as const;
const MIME = { pdf: "application/pdf", png: "image/png", photo: "image/jpeg" } as const;

/** 06: "a statement CSV with an extra header row and a different date format". */
function withExtraHeaderAndIsoDates(formatA: string): string {
  const [header, ...rows] = formatA.split("\r\n");
  const iso = rows.map((row) => row.replace(/^(\d{2})\/(\d{2})\/(\d{4}),/, "$3-$2-$1,"));
  return ["Business Visa ...4821 - Transactions 01/10/2026 to 31/10/2026", "", header, ...iso].join(
    "\r\n",
  );
}

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(RECEIPTS_DIR, { recursive: true });

  const browser = await chromium.launch();
  const intake: IntakeReceipt[] = [];
  try {
    const page = await browser.newPage({
      deviceScaleFactor: 2,
      viewport: { width: 900, height: 1200 },
    });
    for (const [i, r] of STRESS_RECEIPTS.entries()) {
      await page.setContent(r.html, { waitUntil: "load" });
      const doc = page.locator(".doc");
      const fileName = `${r.id}.${EXT[r.file.kind]}`;
      const target = join(RECEIPTS_DIR, fileName);
      if (r.file.kind === "pdf") {
        const box = await doc.boundingBox();
        if (!box) throw new Error(`${r.id}: nothing rendered`);
        const pdf = await page.pdf({
          width: `${Math.ceil(box.width)}px`,
          height: `${Math.ceil(box.height)}px`,
          printBackground: true,
          pageRanges: "1",
        });
        writeFileSync(target, stabilisePdf(pdf));
      } else if (r.file.kind === "png") {
        writeFileSync(target, await doc.screenshot({ type: "png" }));
      } else {
        writeFileSync(
          target,
          await degrade(await doc.screenshot({ type: "png" }), r.file, 4000 + i),
        );
      }

      const file: IntakeReceipt["file"] = {
        path: `receipts/${fileName}`,
        mime: MIME[r.file.kind],
        sha256: createHash("sha256").update(readFileSync(target)).digest("hex"),
      };
      if (r.file.kind !== "pdf") {
        const meta = await sharp(target).metadata();
        if (meta.width) file.width = meta.width;
        if (meta.height) file.height = meta.height;
      }
      intake.push({
        id: r.id,
        monthKey: STRESS_MONTH,
        submitterId: r.submitterId,
        paymentSource: r.paymentSource,
        businessPurpose: r.businessPurpose,
        uploadOrder: i + 1,
        file,
      });
      process.stdout.write(".");
    }
    process.stdout.write("\n");
  } finally {
    await browser.close();
  }

  writeJson(join(OUT, "receipts.json"), Intake.parse({ monthKey: STRESS_MONTH, receipts: intake }));
  writeJson(join(OUT, "truth.json"), {
    monthKey: STRESS_MONTH,
    generatedBy: "scripts/generate-stress.ts",
    receipts: STRESS_RECEIPTS.map(({ html: _html, ...r }) => r),
    statementLines: STRESS_LINES,
  });
  writeFileSync(join(OUT, "statement-format-a.csv"), toFormatA(STRESS_LINES));

  const october = GroundTruth.parse(
    JSON.parse(readFileSync(join(ROOT, "fixtures", "dataset", "ground-truth.json"), "utf8")),
  );
  writeFileSync(
    join(OUT, "statement-extra-header-iso-dates.csv"),
    withExtraHeaderAndIsoDates(toFormatA(october.statementLines)),
  );

  console.log(
    `Wrote ${intake.length} stress receipts, ${STRESS_LINES.length} statement lines, and the extra-header statement.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
