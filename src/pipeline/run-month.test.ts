import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFormatA } from "@/adapters/statement/format-a";
import { parseEnv } from "@/config/env";
import type { CategoryConfig } from "@/core/categories";
import { GroundTruth, Intake } from "../../scripts/dataset/schema";
import { FlatFxClient, OracleModelClient } from "./oracle";
import { configFromEnv, runMonth } from "./run-month";

// The whole October month through the real pipeline and rules, with perfect extraction.
// Every expected value below comes from the hand-written ground truth.

const ROOT = join(import.meta.dirname, "../..");
const DATASET = join(ROOT, "fixtures/dataset");
const read = (p: string) => readFileSync(join(DATASET, p), "utf8");

const intake = Intake.parse(JSON.parse(read("receipts.json")));
const truth = GroundTruth.parse(JSON.parse(read("ground-truth.json")));
const categories = JSON.parse(
  readFileSync(join(ROOT, "config/categories.json"), "utf8"),
) as CategoryConfig;

async function runOracleMonth() {
  const filenames = new Map(intake.receipts.map((r) => [r.id, r.file.path.split("/").pop() ?? ""]));
  return runMonth(
    {
      monthKey: intake.monthKey,
      receipts: intake.receipts,
      statementLines: parseFormatA(read("statement-format-a.csv")),
      readFile: async () => Buffer.from(""),
    },
    {
      model: new OracleModelClient(truth.receipts, filenames),
      fx: new FlatFxClient(),
      config: configFromEnv(parseEnv({}), categories),
      runId: "test",
    },
  );
}

describe("runMonth with perfect extraction (oracle)", async () => {
  const result = await runOracleMonth();
  const byId = new Map(result.receipts.map((r) => [r.id, r]));

  it.each(truth.receipts.map((t) => [t.id, t] as const))(
    "%s: status, statement line, exceptions, and category match the ground truth",
    (_id, t) => {
      const r = byId.get(t.id);
      expect({
        status: r?.state.status,
        line: r?.match?.statementLineId ?? null,
        exceptions: r?.state.exceptions,
        category: r?.category?.category,
        duplicateOf: r?.duplicateOf,
      }).toEqual({
        status: t.matchStatus,
        // Ambiguous items have no line until a person chooses (TC04, TC11).
        line: t.matchStatus === "ambiguous" ? null : t.statementLineId,
        exceptions: [...t.exceptions].sort(),
        category: t.category,
        duplicateOf: t.duplicateOf,
      });
    },
  );

  it("before any decision, lines with no receipt are the 9 true ones plus ambiguous candidates", () => {
    const listed = result.noReceiptLines.map((l) => l.id);
    const trueNone = truth.statementLines.filter((l) => l.receiptId === null).map((l) => l.id);
    expect(listed).toEqual(expect.arrayContaining(trueNone));
    // L16 (TC04) and L22 (TC11) wait for the human's choice.
    expect(listed.filter((id) => !trueNone.includes(id)).sort()).toEqual(["L16", "L22"]);
  });

  it("the small difference shows a +$2.00 badge (TC05)", () => {
    expect(byId.get("R05")?.difference).toEqual({ amount: 2, currency: "AUD" });
  });

  it("the run log has no receipt content: ids, stages, numbers, and codes only", () => {
    const text = JSON.stringify(result.log);
    for (const t of truth.receipts) expect(text).not.toContain(t.fields.vendor);
  });
});
