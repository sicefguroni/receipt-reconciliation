import type { ReasoningEffort } from "@/adapters/model/types";
import type { Env } from "@/config/env";
import type { CategoryConfig } from "@/core/categories";
import type { MatchPolicy } from "@/core/matching";
import type { QualityPolicy } from "@/core/quality";

// Policy and model settings for one pipeline run, built from .env (thresholds are policy,
// not code: docs/sprint/05-business-rules.md).

export interface PipelineConfig {
  matchPolicy: MatchPolicy;
  qualityPolicy: QualityPolicy;
  extractConfidenceMin: number;
  categoryConfidenceMin: number;
  modelExtract: string;
  modelCategorise: string;
  effort: ReasoningEffort;
  categories: CategoryConfig;
}

export function configFromEnv(env: Env, categories: CategoryConfig): PipelineConfig {
  return {
    matchPolicy: {
      pctThreshold: env.AMOUNT_DIFF_PCT_THRESHOLD,
      audThreshold: env.AMOUNT_DIFF_AUD_THRESHOLD,
      minScore: env.AUTO_MATCH_MIN_SCORE,
      minMargin: env.AUTO_MATCH_MIN_MARGIN,
      maxDaysApart: env.MATCH_MAX_DAYS_APART,
    },
    qualityPolicy: {
      minLongSide: env.QUALITY_MIN_LONG_SIDE,
      minShortSide: env.QUALITY_MIN_SHORT_SIDE,
    },
    extractConfidenceMin: env.EXTRACT_CONFIDENCE_MIN,
    categoryConfidenceMin: env.CATEGORY_CONFIDENCE_MIN,
    modelExtract: env.MODEL_EXTRACT,
    modelCategorise: env.MODEL_CATEGORISE,
    effort: env.MODEL_REASONING_EFFORT,
    categories,
  };
}
