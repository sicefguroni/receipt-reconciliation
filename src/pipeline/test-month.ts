import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readStatement } from "@/adapters/statement/read-statement";
import { parseEnv } from "@/config/env";
import type { CategoryConfig } from "@/core/categories";
import type { Decision, DecisionChange } from "@/core/schemas";
import { GroundTruth, Intake } from "../../scripts/dataset/schema";
import { configFromEnv } from "./config";
import { FlatFxClient, OracleModelClient } from "./oracle";
import type { MonthSnapshot } from "./read-month";
import { runMonthSnapshot } from "./run-month";

// Test fixture: the October month read with perfect extraction (oracle) and a flat FX rate,
// so decision tests run through the real rules with no API key.

const ROOT = join(import.meta.dirname, "../..");
const read = (p: string) => readFileSync(join(ROOT, "fixtures/dataset", p), "utf8");

export const intake = Intake.parse(JSON.parse(read("receipts.json")));
export const truth = GroundTruth.parse(JSON.parse(read("ground-truth.json")));
export const testConfig = configFromEnv(
  parseEnv({}),
  JSON.parse(readFileSync(join(ROOT, "config/categories.json"), "utf8")) as CategoryConfig,
);

export async function oracleSnapshot(): Promise<MonthSnapshot> {
  const filenames = new Map(intake.receipts.map((r) => [r.id, r.file.path.split("/").pop() ?? ""]));
  const { snapshot } = await runMonthSnapshot(
    {
      monthKey: intake.monthKey,
      receipts: intake.receipts,
      statementLines: readStatement(read("statement-format-a.csv")).lines,
      readFile: async () => Buffer.from(""),
    },
    {
      model: new OracleModelClient(truth.receipts, filenames),
      fx: new FlatFxClient(),
      config: testConfig,
      runId: "test",
    },
  );
  return snapshot;
}

export const REVIEWER = "accounts";

let clock = 0;
/** A recorded decision, one second after the previous one. */
export function decision(
  subjectId: string,
  change: DecisionChange,
  reason?: string,
  actorId = REVIEWER,
): Decision {
  clock += 1;
  return {
    id: `d${clock}`,
    subjectId,
    actorId,
    before: null,
    reason: reason ?? null,
    at: new Date(Date.UTC(2026, 10, 3, 9, 0, clock)).toISOString(),
    ...change,
  };
}
