import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildDataset } from "./scenarios";
import { BaselineSubset, GroundTruth, Intake, Splits } from "./schema";

// Checks the committed files in fixtures/dataset against the spec, so a stale or
// hand-edited dataset fails `pnpm test`. Regenerate with `pnpm dataset`.
const DIR = join(import.meta.dirname, "..", "..", "fixtures", "dataset");
const readJson = (name: string): unknown => JSON.parse(readFileSync(join(DIR, name), "utf8"));

const intake = Intake.parse(readJson("receipts.json"));
const truth = GroundTruth.parse(readJson("ground-truth.json"));
const spec = buildDataset();

describe("fixtures/dataset", () => {
  it("matches the current spec (run `pnpm dataset` if this fails)", () => {
    expect(truth.receipts).toEqual(spec.receipts.map((r) => r.truth));
    expect(truth.statementLines).toEqual(spec.statementLines);
    expect(Splits.parse(readJson("splits.json"))).toEqual(spec.splits);
    expect(BaselineSubset.parse(readJson("baseline-subset.json"))).toEqual(spec.baselineSubset);
  });

  it("has every receipt file, with the hash recorded in receipts.json", () => {
    for (const r of intake.receipts) {
      const bytes = readFileSync(join(DIR, r.file.path));
      expect(createHash("sha256").update(bytes).digest("hex"), r.id).toBe(r.file.sha256);
    }
  });

  it("TC07: exact duplicate shares the original's hash; the re-photo does not", () => {
    const hash = (id: string) => intake.receipts.find((r) => r.id === id)?.file.sha256;
    expect(hash("R09")).toBe(hash("R08"));
    expect(hash("R10")).not.toBe(hash("R08"));
  });

  it("image sizes in receipts.json are the real pixel sizes", async () => {
    for (const r of intake.receipts.filter((x) => x.file.mime !== "application/pdf")) {
      const meta = await sharp(join(DIR, r.file.path)).metadata();
      expect([meta.width, meta.height], r.id).toEqual([r.file.width, r.file.height]);
    }
  });

  it("TC08: the portrait photo is a 900 x 1200 JPEG", () => {
    const r = intake.receipts.find((x) => x.id === "R11");
    expect(r?.file).toMatchObject({ mime: "image/jpeg", width: 900, height: 1200 });
  });

  it("both statement formats have one row per statement line", () => {
    for (const name of ["statement-format-a.csv", "statement-format-b.csv"]) {
      const rows = readFileSync(join(DIR, name), "utf8").trim().split(/\r?\n/);
      expect(rows.length - 1, name).toBe(truth.statementLines.length);
    }
  });
});
