import type { Env } from "@/config/env";
import { OpenAIModelClient } from "./openai";
import { ReplayModelClient } from "./replay";
import type { ModelClient } from "./types";

export function createModelClient(env: Env): ModelClient {
  if (env.MODE === "replay") return new ReplayModelClient();
  // parseEnv guarantees the key in live mode; this guard keeps the type honest.
  if (!env.OPENAI_API_KEY) throw new Error("MODE=live needs OPENAI_API_KEY in .env.");
  return new OpenAIModelClient(env.OPENAI_API_KEY, env.RECORD === "1");
}
