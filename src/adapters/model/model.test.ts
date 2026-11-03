import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { requestKey, writeRecording } from "./recordings";
import { ReplayModelClient } from "./replay";
import { type ModelCall, ModelError, type ModelResponse } from "./types";

const call = (overrides: Partial<ModelCall> = {}): ModelCall => ({
  task: "extract",
  model: "gpt-5.6-sol",
  effort: "low",
  promptVersion: "extract-v1",
  instructions: "Read the receipt.",
  parts: [
    { kind: "text", text: "Receipt R01" },
    {
      kind: "file",
      mime: "application/pdf",
      filename: "R01.pdf",
      data: Buffer.from("pdf bytes"),
      sha256: "a".repeat(64),
    },
  ],
  output: { name: "receipt", schema: z.object({ total: z.number() }) },
  ...overrides,
});

const response: ModelResponse = {
  text: '{"total":18.5}',
  modelId: "gpt-5.6-sol",
  inputTokens: 1200,
  outputTokens: 80,
  latencyMs: 2100,
};

describe("model recordings and replay", () => {
  it("the same request always gives the same key", () => {
    expect(requestKey(call())).toBe(requestKey(call()));
  });

  it("the key changes with the prompt, schema, model, effort, or file content", () => {
    const base = requestKey(call());
    expect(requestKey(call({ instructions: "Read it carefully." }))).not.toBe(base);
    expect(requestKey(call({ promptVersion: "extract-v2" }))).not.toBe(base);
    expect(requestKey(call({ model: "gpt-6-sol" }))).not.toBe(base);
    expect(requestKey(call({ effort: "high" }))).not.toBe(base);
    expect(
      requestKey(call({ output: { name: "receipt", schema: z.object({ total: z.string() }) } })),
    ).not.toBe(base);
    const otherFile = call();
    const file = otherFile.parts[1];
    if (file?.kind === "file") file.sha256 = "b".repeat(64);
    expect(requestKey(otherFile)).not.toBe(base);
  });

  it("the key depends on the file hash, not the bytes in memory", () => {
    const sameHash = call();
    const file = sameHash.parts[1];
    if (file?.kind === "file") file.data = Buffer.from("different buffer, same recorded hash");
    expect(requestKey(sameHash)).toBe(requestKey(call()));
  });

  it("replay serves a recorded response", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rec-"));
    writeRecording(dir, call(), response);
    expect(await new ReplayModelClient(dir).call(call())).toEqual(response);
  });

  it("replay raises a recorded failure as the same ModelError, so the fallback replays", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rec-"));
    writeRecording(dir, call(), { error: "MODEL_API_ERROR" });
    const failure = await new ReplayModelClient(dir).call(call()).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ModelError);
    expect((failure as ModelError).code).toBe("MODEL_API_ERROR");
  });

  it("replay fails loudly on a miss, saying how to re-record", async () => {
    const replay = new ReplayModelClient(mkdtempSync(join(tmpdir(), "rec-")));
    await expect(replay.call(call())).rejects.toThrow(/MODE=live RECORD=1/);
  });
});
