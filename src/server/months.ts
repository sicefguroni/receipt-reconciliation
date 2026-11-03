import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { asc, desc, eq } from "drizzle-orm";
import { type Db, openDb } from "@/adapters/db/client";
import { decision, monthRun, runLog, vendorRule } from "@/adapters/db/schema";
import { CachedFxClient } from "@/adapters/fx/cached";
import { FrankfurterFxClient, ReplayFxClient } from "@/adapters/fx/frankfurter";
import { FxError } from "@/adapters/fx/types";
import { createModelClient } from "@/adapters/model";
import { ModelError, RecordingMissingError } from "@/adapters/model/types";
import { readStatement, StatementFormatError } from "@/adapters/statement/read-statement";
import { loadCategoryConfig } from "@/config/categories";
import { getEnv } from "@/config/env";
import { addVendorRule } from "@/core/categories";
import { BASE_CURRENCY, Decision, ReceiptIntake } from "@/core/schemas";
import { configFromEnv, type PipelineConfig } from "@/pipeline/config";
import { checkDecision, type DecisionRequest } from "@/pipeline/decisions";
import { fetchRates, type MonthInput, type MonthSnapshot } from "@/pipeline/read-month";
import { type MonthResult, reconcileMonth } from "@/pipeline/reconcile";
import { ERROR_CODE, RunLog, type Stage } from "@/pipeline/run-log";
import { runMonthSnapshot } from "@/pipeline/run-month";

// Server-side entry points for the UI and `pnpm seed`: run a month, store what was read, record
// decisions, and derive the month again from both whenever it is shown.

let db: Db | undefined;
export function getDb(): Db {
  db ??= openDb(getEnv().DATABASE_PATH);
  return db;
}

/** Thresholds from .env; categories from config/categories.json plus learned rules (R-CAT-4). */
export function pipelineConfig(): PipelineConfig {
  const categories = loadCategoryConfig();
  const learned = getDb().select().from(vendorRule).orderBy(asc(vendorRule.createdAt)).all();
  let rules = categories.rules;
  for (const r of learned) rules = addVendorRule(rules, r.keyword, r.category, categories);
  return configFromEnv(getEnv(), { ...categories, rules });
}

function fxClient(): CachedFxClient {
  const env = getEnv();
  const source =
    env.MODE === "live"
      ? new FrankfurterFxClient(env.FX_BASE_URL, env.RECORD === "1")
      : new ReplayFxClient();
  return new CachedFxClient(source, getDb());
}

/** A fixed code for the log: never the message, which can quote file contents. */
export function errorCode(error: unknown): string {
  if (error instanceof RecordingMissingError) return "RECORDING_MISSING";
  if (error instanceof StatementFormatError) return "STATEMENT_FORMAT";
  if (error instanceof FxError || error instanceof ModelError) return error.code;
  return "UNEXPECTED";
}

function saveLog(log: RunLog): void {
  getDb().transaction((tx) => {
    for (const row of log.rows) tx.insert(runLog).values(row).run();
  });
}

/** Writes a failed step to the run log so it shows on the Runs page. */
export function logFailure(runId: string, stage: Stage, error: unknown, log = new RunLog(runId)) {
  const code = errorCode(error);
  log.add({
    receiptId: null,
    stage,
    status: "error",
    durationMs: 0,
    errorCode: ERROR_CODE.test(code) ? code : "UNEXPECTED",
  });
  saveLog(log);
}

/** Reads a statement CSV, logging the outcome (ok, or the failure code). */
export function readStatementLogged(runId: string, text: string) {
  try {
    const parsed = readStatement(text);
    const log = new RunLog(runId);
    log.add({ receiptId: null, stage: "statement", status: "ok", durationMs: 0 });
    saveLog(log);
    return parsed;
  } catch (error) {
    logFailure(runId, "statement", error);
    throw error;
  }
}

export async function runAndStore(
  input: MonthInput,
  runId: string = randomUUID(),
): Promise<string> {
  const env = getEnv();
  const log = new RunLog(runId);
  let snapshot: MonthSnapshot;
  try {
    ({ snapshot } = await runMonthSnapshot(input, {
      model: createModelClient(env),
      fx: fxClient(),
      config: pipelineConfig(),
      runId,
      log,
    }));
  } catch (error) {
    logFailure(runId, "run", error, log);
    throw error;
  }
  getDb().transaction((tx) => {
    tx.insert(monthRun)
      .values({
        id: runId,
        monthKey: snapshot.monthKey,
        mode: snapshot.mode,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        resultJson: JSON.stringify(snapshot),
      })
      .run();
    for (const row of log.rows) tx.insert(runLog).values(row).run();
  });
  return runId;
}

export function getSnapshot(runId: string): MonthSnapshot | null {
  const row = getDb().select().from(monthRun).where(eq(monthRun.id, runId)).get();
  if (!row) return null;
  const snapshot = JSON.parse(row.resultJson) as Partial<MonthSnapshot>;
  // Runs stored before Day 3 hold a derived result, not a snapshot: they cannot be reviewed.
  return snapshot.version === 2 ? (snapshot as MonthSnapshot) : null;
}

export function getDecisions(runId: string): Decision[] {
  return getDb()
    .select()
    .from(decision)
    .where(eq(decision.runId, runId))
    .orderBy(asc(decision.seq))
    .all()
    .map((row) =>
      Decision.parse({
        id: row.id,
        subjectId: row.subjectId,
        actorId: row.actorId,
        action: row.action,
        before: JSON.parse(row.beforeJson),
        after: JSON.parse(row.afterJson),
        reason: row.reason,
        at: row.at,
      }),
    );
}

/** The month as it stands now: what was read, plus every decision so far. */
export function getMonth(runId: string): MonthResult | null {
  const snapshot = getSnapshot(runId);
  return snapshot ? reconcileMonth(snapshot, getDecisions(runId), pipelineConfig()) : null;
}

/** A corrected currency the run has no rates for: fetch them once, into the stored snapshot. */
async function ensureRates(runId: string, snapshot: MonthSnapshot, currency: string) {
  if (currency === BASE_CURRENCY || snapshot.rates.some((r) => r.currency === currency)) return;
  const log = new RunLog(runId);
  let rates: MonthSnapshot["rates"];
  try {
    rates = await fetchRates(currency, snapshot.monthKey, { fx: fxClient(), log });
  } catch (error) {
    logFailure(runId, "fx", error, log);
    return; // no rates: R-CUR-3 applies (FX_RATE_UNAVAILABLE), never a rate of 1
  }
  const next = { ...snapshot, rates: [...snapshot.rates, ...rates] };
  getDb().transaction((tx) => {
    tx.update(monthRun)
      .set({ resultJson: JSON.stringify(next) })
      .where(eq(monthRun.id, runId))
      .run();
    for (const row of log.rows) tx.insert(runLog).values(row).run();
  });
}

/** Checks and records one human decision. Returns a message for the user when refused. */
export async function decide(
  runId: string,
  request: DecisionRequest,
  actorId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const snapshot = getSnapshot(runId);
  if (!snapshot)
    return { ok: false, message: "That month run was not found. Load the month again." };
  const config = pipelineConfig();
  const month = reconcileMonth(snapshot, getDecisions(runId), config);
  const check = checkDecision(month, request, actorId, config);
  if (!check.ok) return check;

  const d = check.decision;
  const id = randomUUID();
  const at = new Date().toISOString();
  if (d.action === "correct_field" && d.after.field === "currency" && d.after.value) {
    await ensureRates(runId, snapshot, d.after.value);
  }
  getDb().transaction((tx) => {
    tx.insert(decision)
      .values({
        id,
        runId,
        subjectId: d.subjectId,
        actorId: d.actorId,
        action: d.action,
        beforeJson: JSON.stringify(d.before ?? null),
        afterJson: JSON.stringify(d.after),
        reason: d.reason ?? null,
        at,
      })
      .run();
    // R-CAT-4: "Always use this category for <vendor>", audited by the decision above.
    if (d.action === "correct_field" && d.after.field === "category" && d.after.alwaysForVendor) {
      const vendor = month.receipts.find((r) => r.id === d.subjectId)?.extraction?.vendor.value;
      const category = d.after.value;
      const [rule] =
        vendor && category ? addVendorRule([], vendor, category, config.categories) : [];
      if (rule && category) {
        tx.insert(vendorRule)
          .values({ keyword: rule.keyword, category, decisionId: id, createdAt: at })
          .onConflictDoUpdate({
            target: vendorRule.keyword,
            set: { category, decisionId: id, createdAt: at },
          })
          .run();
      }
    }
  });
  return { ok: true };
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

export interface StageSummary {
  stage: string;
  ok: number;
  retry: number;
  fallback: number;
  error: number;
  totalMs: number;
  inputTokens: number;
  outputTokens: number;
  errorCodes: Record<string, number>;
}

export interface RunSummary {
  runId: string;
  monthKey: string | null; // null: the run failed before it was stored
  mode: string | null;
  at: string;
  stages: StageSummary[];
  failed: boolean;
}

/** The Runs page: per run, per stage, counts by status, time, tokens, and error codes. */
export function runSummaries(limit = 20): RunSummary[] {
  const rows = getDb().select().from(runLog).orderBy(asc(runLog.id)).all();
  const runs = new Map(
    getDb()
      .select({ id: monthRun.id, monthKey: monthRun.monthKey, mode: monthRun.mode })
      .from(monthRun)
      .all()
      .map((r) => [r.id, r]),
  );
  const byRun = new Map<string, RunSummary>();
  for (const row of rows) {
    let run = byRun.get(row.runId);
    if (!run) {
      const stored = runs.get(row.runId);
      run = {
        runId: row.runId,
        monthKey: stored?.monthKey ?? null,
        mode: stored?.mode ?? null,
        at: row.at,
        stages: [],
        failed: false,
      };
      byRun.set(row.runId, run);
    }
    let stage = run.stages.find((s) => s.stage === row.stage);
    if (!stage) {
      stage = {
        stage: row.stage,
        ok: 0,
        retry: 0,
        fallback: 0,
        error: 0,
        totalMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        errorCodes: {},
      };
      run.stages.push(stage);
    }
    stage[row.status] += 1;
    stage.totalMs += row.durationMs;
    stage.inputTokens += row.inputTokens ?? 0;
    stage.outputTokens += row.outputTokens ?? 0;
    if (row.errorCode) stage.errorCodes[row.errorCode] = (stage.errorCodes[row.errorCode] ?? 0) + 1;
    if (row.status === "error" && (row.stage === "run" || row.stage === "statement")) {
      run.failed = true;
    }
  }
  return [...byRun.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** One run's log rows, for the Runs detail view. IDs, stages, numbers, and codes only. */
export function runLogRows(runId: string) {
  return getDb().select().from(runLog).where(eq(runLog.runId, runId)).orderBy(asc(runLog.id)).all();
}

const SAMPLE_DIR = join(process.cwd(), "fixtures", "dataset");

/** The 40 receipts submitted for the synthetic October month (what staff uploaded). */
export function sampleReceipts(): { monthKey: string; receipts: ReceiptIntake[] } {
  const intake = JSON.parse(readFileSync(join(SAMPLE_DIR, "receipts.json"), "utf8")) as {
    monthKey: string;
    receipts: unknown[];
  };
  return {
    monthKey: intake.monthKey,
    receipts: intake.receipts.map((r) => ReceiptIntake.parse(r)),
  };
}

/** The sample month with a statement: the given CSV text, or the sample format-A export. */
export async function runSampleMonth(statementText?: string): Promise<string> {
  const runId = randomUUID();
  const { monthKey, receipts } = sampleReceipts();
  const statement = readStatementLogged(
    runId,
    statementText ?? readFileSync(join(SAMPLE_DIR, "statement-format-a.csv"), "utf8"),
  );
  return runAndStore(
    {
      monthKey,
      receipts,
      statementLines: statement.lines,
      statementFormat: statement.format,
      fileRoot: "fixtures/dataset",
      readFile: async (r) => readFileSync(join(SAMPLE_DIR, r.file.path)),
    },
    runId,
  );
}
