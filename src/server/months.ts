import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { desc, eq } from "drizzle-orm";
import { type Db, openDb } from "@/adapters/db/client";
import { monthRun, runLog } from "@/adapters/db/schema";
import { CachedFxClient } from "@/adapters/fx/cached";
import { FrankfurterFxClient, ReplayFxClient } from "@/adapters/fx/frankfurter";
import { createModelClient } from "@/adapters/model";
import { parseFormatA } from "@/adapters/statement/format-a";
import { loadCategoryConfig } from "@/config/categories";
import { getEnv } from "@/config/env";
import { ReceiptIntake } from "@/core/schemas";
import { configFromEnv, type MonthInput, type MonthResult, runMonth } from "@/pipeline/run-month";

// Server-side entry points for the UI and `pnpm seed`: run a month, store it, read it back.

let db: Db | undefined;
export function getDb(): Db {
  db ??= openDb(getEnv().DATABASE_PATH);
  return db;
}

export async function runAndStore(input: MonthInput): Promise<string> {
  const env = getEnv();
  const database = getDb();
  const runId = randomUUID();
  const source =
    env.MODE === "live"
      ? new FrankfurterFxClient(env.FX_BASE_URL, env.RECORD === "1")
      : new ReplayFxClient();
  const result = await runMonth(input, {
    model: createModelClient(env),
    fx: new CachedFxClient(source, database),
    config: configFromEnv(env, loadCategoryConfig()),
    runId,
  });
  database.transaction((tx) => {
    tx.insert(monthRun)
      .values({
        id: runId,
        monthKey: result.monthKey,
        mode: result.mode,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        resultJson: JSON.stringify({ ...result, log: [] }),
      })
      .run();
    for (const row of result.log) tx.insert(runLog).values(row).run();
  });
  return runId;
}

export function getRun(runId: string): MonthResult | null {
  const row = getDb().select().from(monthRun).where(eq(monthRun.id, runId)).get();
  return row ? (JSON.parse(row.resultJson) as MonthResult) : null;
}

export function listRuns() {
  return getDb()
    .select({
      id: monthRun.id,
      monthKey: monthRun.monthKey,
      mode: monthRun.mode,
      finishedAt: monthRun.finishedAt,
    })
    .from(monthRun)
    .orderBy(desc(monthRun.finishedAt))
    .limit(10)
    .all();
}

const SAMPLE_DIR = join(process.cwd(), "fixtures", "dataset");

/** The synthetic October month: its 40 receipts and the format-A statement. */
export async function runSampleMonth(): Promise<string> {
  const intake = JSON.parse(readFileSync(join(SAMPLE_DIR, "receipts.json"), "utf8")) as {
    monthKey: string;
    receipts: unknown[];
  };
  return runAndStore({
    monthKey: intake.monthKey,
    receipts: intake.receipts.map((r) => ReceiptIntake.parse(r)),
    statementLines: parseFormatA(readFileSync(join(SAMPLE_DIR, "statement-format-a.csv"), "utf8")),
    readFile: async (r) => readFileSync(join(SAMPLE_DIR, r.file.path)),
  });
}
