import { type ModelClient, ModelError, type ReasoningEffort } from "@/adapters/model/types";
import {
  acceptModelCategory,
  type CategoryConfig,
  type CategoryResult,
  categoriseByRules,
  modelChoices,
} from "@/core/categories";
import { CATEGORISE_INSTRUCTIONS, CATEGORISE_PROMPT_VERSION, categoriseOutput } from "../prompts";
import type { RunLog } from "../run-log";

// Categorise stage: the rule table first (R-CAT-1), the model only when no rule hits (R-CAT-2).
// A model failure leaves the category to a person (UNKNOWN_CATEGORY), never to "Other".

export async function categoriseReceipt(
  input: { receiptId: string; vendor: string | null; summary: string | null },
  deps: {
    model: ModelClient;
    modelId: string;
    effort: ReasoningEffort;
    config: CategoryConfig;
    minConfidence: number;
    log: RunLog;
  },
): Promise<CategoryResult> {
  const byRule = categoriseByRules(input.vendor, input.summary, deps.config.rules);
  if (byRule) {
    deps.log.add({ receiptId: input.receiptId, stage: "categorise", status: "ok", durationMs: 0 });
    return byRule;
  }

  const unknown: CategoryResult = {
    category: null,
    source: "model",
    confidence: 0,
    reason: "No category could be suggested.",
    exceptions: ["UNKNOWN_CATEGORY"],
  };
  if (!input.vendor && !input.summary) return unknown;

  const choices = modelChoices(deps.config);
  const schema = categoriseOutput(choices);
  const started = performance.now();
  try {
    const response = await deps.model.call({
      task: "categorise",
      model: deps.modelId,
      effort: deps.effort,
      promptVersion: CATEGORISE_PROMPT_VERSION,
      instructions: CATEGORISE_INSTRUCTIONS,
      parts: [
        {
          kind: "text",
          text: `Vendor: ${input.vendor ?? "(unknown)"}\nItems: ${input.summary ?? "(unknown)"}\nAllowed categories: ${choices.join("; ")}`,
        },
      ],
      output: { name: "category_choice", schema },
    });
    const parsed = schema.safeParse(JSON.parse(response.text));
    deps.log.add({
      receiptId: input.receiptId,
      stage: "categorise",
      status: parsed.success ? "ok" : "fallback",
      durationMs: response.latencyMs || Math.round(performance.now() - started),
      modelId: response.modelId,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      errorCode: parsed.success ? null : "SCHEMA_INVALID",
    });
    return parsed.success
      ? acceptModelCategory(parsed.data, deps.config, deps.minConfidence)
      : unknown;
  } catch (error) {
    if (!(error instanceof ModelError) && !(error instanceof SyntaxError)) throw error;
    deps.log.add({
      receiptId: input.receiptId,
      stage: "categorise",
      status: "fallback",
      durationMs: Math.round(performance.now() - started),
      modelId: deps.modelId,
      errorCode: error instanceof ModelError ? error.code : "INVALID_JSON",
    });
    return unknown;
  }
}
