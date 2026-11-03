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

// One pipeline run over a month. `result_json` holds what was read (a MonthSnapshot, version 2):
// the input, extractions, categories, and FX rates. Statuses are never stored; they are derived
// from this plus the decisions below each time the month is shown.
export const monthRun = sqliteTable("month_run", {
  id: text("id").primaryKey(),
  monthKey: text("month_key").notNull(),
  mode: text("mode", { enum: ["live", "replay"] }).notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at").notNull(),
  resultJson: text("result_json").notNull(),
});

// Every human action, one immutable row (04, Decision). Rows are only ever inserted.
export const decision = sqliteTable("decision", {
  seq: integer("seq").primaryKey({ autoIncrement: true }),
  id: text("id").notNull().unique(),
  runId: text("run_id")
    .notNull()
    .references(() => monthRun.id),
  subjectId: text("subject_id").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  beforeJson: text("before_json").notNull(),
  afterJson: text("after_json").notNull(),
  reason: text("reason"),
  at: text("at").notNull(),
});

// R-CAT-4: "Always use this category for <vendor>". Applied before config/categories.json on
// the next run; the decision that created it is the audit record.
export const vendorRule = sqliteTable("vendor_rule", {
  keyword: text("keyword").primaryKey(),
  category: text("category").notNull(),
  decisionId: text("decision_id").notNull(),
  createdAt: text("created_at").notNull(),
});
