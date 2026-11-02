import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
