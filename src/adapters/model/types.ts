import type { z } from "zod";
import type { FileMime } from "@/core/schemas";

// The model boundary (04, "Replay mode"). The pipeline builds a ModelCall; a live client
// sends it to the API, a replay client serves the recorded response for the same request.

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high";

export type ModelPart =
  | { kind: "text"; text: string }
  | { kind: "file"; mime: FileMime; filename: string; data: Buffer; sha256: string };

export interface ModelCall {
  task: "extract" | "categorise";
  model: string;
  effort: ReasoningEffort;
  /** Bump when the prompt's meaning changes; it is part of the recording key. */
  promptVersion: string;
  instructions: string;
  parts: ModelPart[];
  output: { name: string; schema: z.ZodType };
}

export interface ModelResponse {
  /** The model's JSON text. The caller validates it with Zod (validation retry lives there). */
  text: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  /** API time when recorded; replay reports the recorded value so latency stays comparable. */
  latencyMs: number;
}

export interface ModelClient {
  readonly mode: "live" | "replay";
  call(request: ModelCall): Promise<ModelResponse>;
}

/** A model failure the pipeline recovers from (fallback to manual entry). Codes go to run_log. */
export class ModelError extends Error {
  constructor(
    readonly code: "MODEL_API_ERROR" | "MODEL_REFUSED" | "MODEL_EMPTY_OUTPUT",
    message: string,
  ) {
    super(message);
    this.name = "ModelError";
  }
}

/** Replay has no response for this request. Never recovered from: replay must fail loudly. */
export class RecordingMissingError extends Error {
  constructor(
    readonly key: string,
    task: string,
  ) {
    super(
      `No recorded model response for this ${task} request (key ${key.slice(0, 12)}). ` +
        "The prompt, schema, model, or file changed since it was recorded. Re-record with " +
        "MODE=live RECORD=1 (for example `pnpm eval -- --mode live --label <name>`).",
    );
    this.name = "RecordingMissingError";
  }
}
