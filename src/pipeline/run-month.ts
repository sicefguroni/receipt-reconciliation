import type { FxClient } from "@/adapters/fx/types";
import type { ModelClient } from "@/adapters/model/types";
import type { PipelineConfig } from "./config";
import { type MonthInput, type MonthSnapshot, readMonth } from "./read-month";
import { type MonthResult, reconcileMonth } from "./reconcile";
import { RunLog } from "./run-log";

// The month pipeline (04): read (quality gate -> extract -> categorise per receipt, FX fetch),
// then reconcile (duplicates, matching, exceptions, queue order). Reading does the I/O;
// reconciling is pure and runs again after every human decision. Every money decision is a
// src/core function.

export { configFromEnv, type PipelineConfig } from "./config";
export { fxRange, type MonthInput, type MonthSnapshot } from "./read-month";
export type { MonthResult, ReceiptResult } from "./reconcile";

export interface PipelineDeps {
  model: ModelClient;
  fx: FxClient;
  config: PipelineConfig;
  runId: string;
  /** Pass one in to keep the rows written before a failure; otherwise a new one is made. */
  log?: RunLog;
}

/**
 * Reads the month, then reconciles it once with no decisions so duplicate detection and
 * matching appear in the run log with their timing (they run again, unlogged, on every view).
 */
export async function runMonthSnapshot(
  input: MonthInput,
  deps: PipelineDeps,
): Promise<{ snapshot: MonthSnapshot; log: RunLog; result: MonthResult }> {
  const log = deps.log ?? new RunLog(deps.runId);
  const snapshot = await readMonth(input, { ...deps, log });
  const started = performance.now();
  const result = reconcileMonth(snapshot, [], deps.config);
  log.add({
    receiptId: null,
    stage: "match",
    status: "ok",
    durationMs: Math.round(performance.now() - started),
  });
  return { snapshot, log, result };
}

/** Reads the month and reconciles it with no human decisions: what `pnpm eval` scores. */
export async function runMonth(input: MonthInput, deps: PipelineDeps): Promise<MonthResult> {
  const { log, result } = await runMonthSnapshot(input, deps);
  return { ...result, log: log.rows };
}
