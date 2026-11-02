import { z } from "zod";

// Every threshold here is policy, not code: see docs/sprint/05-business-rules.md.
// Defaults mirror .env.example so `pnpm dev` works with no .env in replay mode.
const EnvSchema = z
  .object({
    MODE: z.enum(["live", "replay"]).default("replay"),
    RECORD: z.enum(["0", "1"]).default("0"),
    ANTHROPIC_API_KEY: z.string().trim().optional(),
    MODEL_EXTRACT: z.string().min(1).default("claude-sonnet-5-5"),
    MODEL_CATEGORISE: z.string().min(1).default("claude-haiku-5-5"),

    FX_BASE_URL: z.url().default("https://api.frankfurter.dev/v1"),

    DATABASE_PATH: z.string().min(1).default("./data/app.db"),
    FILE_STORE_DIR: z.string().min(1).default("./data/files"),

    AMOUNT_DIFF_PCT_THRESHOLD: z.coerce.number().positive().default(10),
    AMOUNT_DIFF_AUD_THRESHOLD: z.coerce.number().positive().default(100),
    AUTO_MATCH_MIN_SCORE: z.coerce.number().int().min(0).max(100).default(75),
    AUTO_MATCH_MIN_MARGIN: z.coerce.number().int().min(0).max(100).default(20),
    EXTRACT_CONFIDENCE_MIN: z.coerce.number().min(0).max(1).default(0.8),
    CATEGORY_CONFIDENCE_MIN: z.coerce.number().min(0).max(1).default(0.7),
    QUALITY_MIN_LONG_SIDE: z.coerce.number().int().positive().default(1000),
    QUALITY_MIN_SHORT_SIDE: z.coerce.number().int().positive().default(700),
  })
  .superRefine((env, ctx) => {
    if (env.MODE === "live" && !env.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["ANTHROPIC_API_KEY"],
        message: "MODE=live needs ANTHROPIC_API_KEY. Set it in .env, or use MODE=replay.",
      });
    }
    if (env.RECORD === "1" && env.MODE !== "live") {
      ctx.addIssue({
        code: "custom",
        path: ["RECORD"],
        message: "RECORD=1 only works with MODE=live (replay mode has nothing new to record).",
      });
    }
    if (env.QUALITY_MIN_SHORT_SIDE > env.QUALITY_MIN_LONG_SIDE) {
      ctx.addIssue({
        code: "custom",
        path: ["QUALITY_MIN_SHORT_SIDE"],
        message: "QUALITY_MIN_SHORT_SIDE cannot be larger than QUALITY_MIN_LONG_SIDE.",
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

// Blank values in .env (e.g. `ANTHROPIC_API_KEY=`) mean "not set", so the default applies.
function dropBlank(source: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, string] => {
      const value = entry[1];
      return value !== undefined && value.trim() !== "";
    }),
  );
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(dropBlank(source));
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Configuration problem in .env:\n${problems}`);
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
