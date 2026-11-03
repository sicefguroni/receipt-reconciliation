import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// One row per receipt per pipeline stage (docs/sprint/04-system-design.md).
// Never store receipt contents, names, card numbers, or raw model output here.
export const runLog = sqliteTable("run_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: text("run_id").notNull(),
  receiptId: text("receipt_id"),
  stage: text("stage").notNull(),
  status: text("status", { enum: ["ok", "retry", "fallback", "error"] }).notNull(),
  durationMs: integer("duration_ms").notNull(),
  modelId: text("model_id"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  errorCode: text("error_code"),
  at: text("at").notNull(),
});

// FX reference rates cached from the FX API (04: "cached in SQLite"). When the API is
// down, the pipeline falls back to these; with none in range, R-CUR-3 applies.
export const fxRate = sqliteTable(
  "fx_rate",
  {
    currency: text("currency").notNull(),
    date: text("date").notNull(),
    audPerUnit: real("aud_per_unit").notNull(),
    source: text("source").notNull(),
    fetchedAt: text("fetched_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.currency, t.date] })],
);

// One pipeline run over a month. v0 stores the derived result as JSON for the pages;
// Day 3 adds per-item tables for decisions.
export const monthRun = sqliteTable("month_run", {
  id: text("id").primaryKey(),
  monthKey: text("month_key").notNull(),
  mode: text("mode", { enum: ["live", "replay"] }).notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at").notNull(),
  resultJson: text("result_json").notNull(),
});
