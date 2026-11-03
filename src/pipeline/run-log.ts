// One row per receipt per stage (04). IDs, stage names, durations, token counts, and error
// codes only: never receipt text, names, card numbers, or raw model output.

// `statement` is reading the uploaded CSV; `run` is a failure that stopped the whole run.
export type Stage =
  | "statement"
  | "quality"
  | "extract"
  | "fx"
  | "categorise"
  | "duplicates"
  | "match"
  | "run";

/** Error codes are fixed words, never messages: a message can quote a file's contents. */
export const ERROR_CODE = /^[A-Z][A-Z0-9_]{1,40}$/;

export interface RunLogRow {
  runId: string;
  receiptId: string | null;
  stage: Stage;
  status: "ok" | "retry" | "fallback" | "error";
  durationMs: number;
  modelId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorCode: string | null;
  at: string;
}

export class RunLog {
  readonly rows: RunLogRow[] = [];

  constructor(readonly runId: string) {}

  add(
    row: Omit<
      RunLogRow,
      "runId" | "at" | "modelId" | "inputTokens" | "outputTokens" | "errorCode"
    > &
      Partial<Pick<RunLogRow, "modelId" | "inputTokens" | "outputTokens" | "errorCode">>,
  ): void {
    this.rows.push({
      runId: this.runId,
      modelId: null,
      inputTokens: null,
      outputTokens: null,
      errorCode: null,
      ...row,
      at: new Date().toISOString(),
    });
  }
}
