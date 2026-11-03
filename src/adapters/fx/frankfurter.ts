import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { FxRate } from "@/core/currency";
import { type FxClient, FxError } from "./types";

// Frankfurter (ECB reference rates, no key). Endpoint verified 2026-11-03:
//   GET {base}/{from}..{to}?base=USD&symbols=AUD
//   -> { base, start_date, end_date, rates: { "2026-10-02": { "AUD": 1.4411 }, ... } }

export const SOURCE = "ECB via Frankfurter";
export const DEFAULT_FX_RECORDINGS_DIR = join(process.cwd(), "fixtures", "recordings", "fx");

const RangeResponse = z.object({
  base: z.string(),
  rates: z.record(z.string(), z.object({ AUD: z.number().positive() })),
});

export function parseRangeResponse(currency: string, body: unknown): FxRate[] {
  const parsed = RangeResponse.parse(body);
  return Object.entries(parsed.rates)
    .map(([date, r]) => ({ currency, date, audPerUnit: r.AUD, source: SOURCE }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function recordingPath(dir: string, currency: string, from: string, to: string): string {
  return join(dir, `${currency}_${from}_${to}.json`);
}

export class FrankfurterFxClient implements FxClient {
  constructor(
    private readonly baseUrl: string,
    private readonly record = false,
    private readonly recordingsDir = DEFAULT_FX_RECORDINGS_DIR,
  ) {}

  async getRates(currency: string, from: string, to: string): Promise<FxRate[]> {
    const url = `${this.baseUrl}/${from}..${to}?base=${encodeURIComponent(currency)}&symbols=AUD`;
    let body: unknown;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      body = await res.json();
    } catch (error) {
      const why = error instanceof Error ? error.message : "unknown error";
      throw new FxError("FX_API_ERROR", `The FX rate service could not be reached (${why}).`);
    }
    const rates = parseRangeResponse(currency, body);
    if (this.record) {
      mkdirSync(this.recordingsDir, { recursive: true });
      writeFileSync(
        recordingPath(this.recordingsDir, currency, from, to),
        `${JSON.stringify(body, null, 2)}\n`,
      );
    }
    return rates;
  }
}

/** Replay: serves recorded API responses so the eval runs offline. Fails loudly on a miss. */
export class ReplayFxClient implements FxClient {
  constructor(private readonly recordingsDir = DEFAULT_FX_RECORDINGS_DIR) {}

  async getRates(currency: string, from: string, to: string): Promise<FxRate[]> {
    const path = recordingPath(this.recordingsDir, currency, from, to);
    if (!existsSync(path)) {
      throw new FxError(
        "FX_RECORDING_MISSING",
        `No recorded FX rates for ${currency} ${from}..${to}. Re-record with MODE=live RECORD=1.`,
      );
    }
    return parseRangeResponse(currency, JSON.parse(readFileSync(path, "utf8")));
  }
}
