import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import { DEFAULT_RECORDINGS_DIR, writeRecording } from "./recordings";
import {
  type ModelCall,
  type ModelClient,
  ModelError,
  type ModelPart,
  type ModelResponse,
} from "./types";

// Live client: the OpenAI Responses API with structured output (decision log, 2026-11-03).
// The SDK retries connection errors, 408, 409, 429, and 5xx twice with backoff, which is the
// "retry twice" behaviour in 04; after that the pipeline falls back to manual entry.

function toContent(part: ModelPart): ResponseInputContent {
  if (part.kind === "text") return { type: "input_text", text: part.text };
  const dataUrl = `data:${part.mime};base64,${part.data.toString("base64")}`;
  if (part.mime === "application/pdf") {
    return { type: "input_file", filename: part.filename, file_data: dataUrl };
  }
  return { type: "input_image", image_url: dataUrl, detail: "high" };
}

export class OpenAIModelClient implements ModelClient {
  readonly mode = "live" as const;
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly record: boolean,
    private readonly recordingsDir = DEFAULT_RECORDINGS_DIR,
  ) {
    this.client = new OpenAI({ apiKey, maxRetries: 2, timeout: 90_000 });
  }

  async call(request: ModelCall): Promise<ModelResponse> {
    try {
      const result = await this.send(request);
      if (this.record) writeRecording(this.recordingsDir, request, result);
      return result;
    } catch (error) {
      // Without this, a failure in a live run left no recording, and replaying that run with
      // no key stopped on a missing recording instead of taking the same fallback.
      if (error instanceof ModelError && this.record) {
        writeRecording(this.recordingsDir, request, { error: error.code });
      }
      throw error;
    }
  }

  private async send(request: ModelCall): Promise<ModelResponse> {
    const started = performance.now();
    let response: OpenAI.Responses.Response;
    try {
      response = await this.client.responses.create({
        model: request.model,
        instructions: request.instructions,
        input: [{ role: "user", content: request.parts.map(toContent) }],
        reasoning: { effort: request.effort },
        text: { format: zodTextFormat(request.output.schema, request.output.name) },
        // Receipts are not kept on the provider's side for later retrieval.
        store: false,
      });
    } catch (error) {
      // The status code only: the error body can echo request content.
      const status = error instanceof OpenAI.APIError ? ` (HTTP ${error.status ?? "none"})` : "";
      throw new ModelError("MODEL_API_ERROR", `The model API call failed${status}.`);
    }

    const refused = response.output.some(
      (item) => item.type === "message" && item.content.some((c) => c.type === "refusal"),
    );
    if (refused) throw new ModelError("MODEL_REFUSED", "The model declined to read this file.");
    if (!response.output_text) {
      throw new ModelError(
        "MODEL_EMPTY_OUTPUT",
        `The model returned no output (${response.status}).`,
      );
    }

    return {
      text: response.output_text,
      modelId: response.model,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      latencyMs: Math.round(performance.now() - started),
    };
  }
}
