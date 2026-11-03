import {
  type ModelClient,
  ModelError,
  type ModelPart,
  type ReasoningEffort,
} from "@/adapters/model/types";
import { maskCardNumbers } from "@/core/privacy";
import { Extraction, type FileMime } from "@/core/schemas";
import { EXTRACT_INSTRUCTIONS, EXTRACT_PROMPT_VERSION, ExtractionOutput } from "../prompts";
import type { RunLog } from "../run-log";

// Extract stage (04, "Pipeline behaviour"): model errors are retried by the SDK; output that
// fails schema validation is retried once with the validation error appended; after that the
// receipt falls back to manual entry and the pipeline carries on with the others.

export interface ExtractInput {
  receiptId: string;
  filename: string;
  mime: FileMime;
  data: Buffer;
  sha256: string;
}

export type ExtractOutcome =
  | { ok: true; extraction: Extraction; lowConfidenceFields: string[] }
  | { ok: false; reason: string };

const REQUIRED_FIELDS = ["vendor", "date", "total", "currency"] as const;
const ALL_FIELDS = [...REQUIRED_FIELDS, "tax", "summary"] as const;

function describeIssues(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.map(String).join(".")}: ${i.message}`)
    .join("; ");
}

/**
 * LOW_CONFIDENCE_FIELD (04): a field whose confidence is under the minimum, or a required
 * field with no value. Tax and summary may legitimately be blank.
 */
export function lowConfidenceFields(extraction: Extraction, minConfidence: number): string[] {
  return ALL_FIELDS.filter((name) => {
    const f = extraction[name];
    const required = (REQUIRED_FIELDS as readonly string[]).includes(name);
    return (required && f.value === null) || (f.value !== null && f.confidence < minConfidence);
  });
}

export async function extractReceipt(
  input: ExtractInput,
  deps: {
    model: ModelClient;
    modelId: string;
    effort: ReasoningEffort;
    minConfidence: number;
    log: RunLog;
  },
): Promise<ExtractOutcome> {
  const file: ModelPart = {
    kind: "file",
    mime: input.mime,
    filename: input.filename,
    data: input.data,
    sha256: input.sha256,
  };
  const parts: ModelPart[] = [{ kind: "text", text: `File: ${input.filename}` }, file];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = performance.now();
    let text: string;
    try {
      const response = await deps.model.call({
        task: "extract",
        model: deps.modelId,
        effort: deps.effort,
        promptVersion: EXTRACT_PROMPT_VERSION,
        instructions: EXTRACT_INSTRUCTIONS,
        parts,
        output: { name: "receipt_fields", schema: ExtractionOutput },
      });
      text = response.text;
      const result = Extraction.safeParse(safeJson(text));
      deps.log.add({
        receiptId: input.receiptId,
        stage: "extract",
        status: result.success ? "ok" : "retry",
        durationMs: response.latencyMs || Math.round(performance.now() - started),
        modelId: response.modelId,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        errorCode: result.success ? null : "SCHEMA_INVALID",
      });
      if (result.success) {
        const extraction = maskExtraction(result.data);
        return {
          ok: true,
          extraction,
          lowConfidenceFields: lowConfidenceFields(extraction, deps.minConfidence),
        };
      }
      // One retry, with the problem stated so the model can correct it.
      parts.push({
        kind: "text",
        text: `Your previous answer failed validation (${describeIssues(result.error)}). Return corrected JSON for the same file.`,
      });
    } catch (error) {
      if (!(error instanceof ModelError)) throw error; // e.g. a missing replay recording
      deps.log.add({
        receiptId: input.receiptId,
        stage: "extract",
        status: "fallback",
        durationMs: Math.round(performance.now() - started),
        modelId: deps.modelId,
        errorCode: error.code,
      });
      return {
        ok: false,
        reason: "We could not read this receipt automatically. Enter its details by hand.",
      };
    }
  }
  deps.log.add({
    receiptId: input.receiptId,
    stage: "extract",
    status: "fallback",
    durationMs: 0,
    modelId: deps.modelId,
    errorCode: "SCHEMA_INVALID_TWICE",
  });
  return {
    ok: false,
    reason: "We could not read this receipt automatically. Enter its details by hand.",
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 04: card numbers are masked on the model's output, whatever the prompt said. */
function maskExtraction(e: Extraction): Extraction {
  const mask = (v: string | null) => (v === null ? null : maskCardNumbers(v));
  return {
    ...e,
    vendor: { ...e.vendor, value: mask(e.vendor.value) },
    summary: { ...e.summary, value: mask(e.summary.value) },
  };
}
