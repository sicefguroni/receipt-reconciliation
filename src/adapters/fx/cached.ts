import { and, between, eq } from "drizzle-orm";
import type { FxRate } from "@/core/currency";
import type { Db } from "../db/client";
import { fxRate } from "../db/schema";
import { type FxClient, FxError } from "./types";

export type FxFetchOutcome = "fetched" | "cache_fallback";

/**
 * Wraps a live or replay client with the SQLite cache (04: "cached in SQLite").
 * Fetched rates are stored. If the source fails, cached rates for the range are served
 * instead, and `onFallback` reports it for the run log. With nothing cached, the result is
 * empty and src/core flags FX_RATE_UNAVAILABLE (R-CUR-3); a rate is never defaulted to 1.
 * A missing replay recording is not an outage and is re-thrown.
 */
export class CachedFxClient implements FxClient {
  constructor(
    private readonly inner: FxClient,
    private readonly db: Db,
    private readonly onFallback?: (error: FxError) => void,
  ) {}

  async getRates(currency: string, from: string, to: string): Promise<FxRate[]> {
    try {
      const rates = await this.inner.getRates(currency, from, to);
      const fetchedAt = new Date().toISOString();
      for (const r of rates) {
        this.db
          .insert(fxRate)
          .values({ ...r, fetchedAt })
          .onConflictDoUpdate({
            target: [fxRate.currency, fxRate.date],
            set: { audPerUnit: r.audPerUnit, source: r.source, fetchedAt },
          })
          .run();
      }
      return rates;
    } catch (error) {
      if (!(error instanceof FxError) || error.code === "FX_RECORDING_MISSING") throw error;
      this.onFallback?.(error);
      return this.db
        .select()
        .from(fxRate)
        .where(and(eq(fxRate.currency, currency), between(fxRate.date, from, to)))
        .all()
        .map(({ fetchedAt: _fetchedAt, ...rate }) => rate);
    }
  }
}
