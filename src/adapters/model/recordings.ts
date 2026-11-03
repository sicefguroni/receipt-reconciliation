import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { type ModelCall, ModelErrorCode, type ModelResponse } from "./types";

// Recorded model responses for replay mode, committed under fixtures/recordings/model.
// The key covers everything that can change the answer: task, model, effort, prompt,
// output schema, and the content of each part (files by their SHA-256, never their bytes).

export const DEFAULT_RECORDINGS_DIR = join(process.cwd(), "fixtures", "recordings", "model");

export function requestKey(request: ModelCall): string {
  const canonical = {
    task: request.task,
    model: request.model,
    effort: request.effort,
    promptVersion: request.promptVersion,
    instructions: request.instructions,
    output: { name: request.output.name, schema: z.toJSONSchema(request.output.schema) },
    parts: request.parts.map((p) =>
      p.kind === "text" ? { text: p.text } : { file: p.sha256, mime: p.mime },
    ),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

const Recording = z.object({
  key: z.string(),
  task: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  recordedAt: z.string(),
  // What was sent, without file bytes: lets a reviewer see which receipt a recording is for.
  parts: z.array(z.union([z.object({ text: z.string() }), z.object({ file: z.string() })])),
  response: z.union([
    z.object({
      text: z.string(),
      modelId: z.string(),
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      latencyMs: z.number().nonnegative(),
    }),
    // A failed call, recorded by its code only (an error body can echo request content), so
    // replay reproduces the pipeline's fallback instead of stopping on a missing recording.
    z.object({ error: ModelErrorCode }),
  ]),
});

export type RecordedOutcome = z.infer<typeof Recording>["response"];

function pathFor(dir: string, key: string): string {
  return join(dir, `${key}.json`);
}

export function readRecording(dir: string, key: string): RecordedOutcome | null {
  const path = pathFor(dir, key);
  if (!existsSync(path)) return null;
  return Recording.parse(JSON.parse(readFileSync(path, "utf8"))).response;
}

export function writeRecording(
  dir: string,
  request: ModelCall,
  response: ModelResponse | { error: ModelErrorCode },
): void {
  mkdirSync(dir, { recursive: true });
  const key = requestKey(request);
  const recording: z.infer<typeof Recording> = {
    key,
    task: request.task,
    model: request.model,
    promptVersion: request.promptVersion,
    recordedAt: new Date().toISOString(),
    parts: request.parts.map((p) =>
      p.kind === "text" ? { text: p.text } : { file: `${p.filename} sha256:${p.sha256}` },
    ),
    response,
  };
  writeFileSync(pathFor(dir, key), `${JSON.stringify(recording, null, 2)}\n`);
}
