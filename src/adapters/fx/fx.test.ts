import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../db/client";
import { CachedFxClient } from "./cached";
import { parseRangeResponse, ReplayFxClient } from "./frankfurter";
import { type FxClient, FxError } from "./types";

// A real Frankfurter range response (captured 2026-11-03), trimmed to three days.
const BODY = {
  amount: 1.0,
  base: "USD",
  start_date: "2026-10-01",
  end_date: "2026-10-05",
  rates: {
    "2026-10-01": { AUD: 1.4388 },
    "2026-10-02": { AUD: 1.4411 },
    "2026-10-05": { AUD: 1.4367 },
  },
};

const failing: FxClient = {
  getRates: async () => {
    throw new FxError("FX_API_ERROR", "The FX rate service could not be reached (offline).");
  },
};

describe("FX adapters", () => {
  it("parses a Frankfurter range response into dated AUD rates", () => {
    expect(parseRangeResponse("USD", BODY)).toEqual([
      { currency: "USD", date: "2026-10-01", audPerUnit: 1.4388, source: "ECB via Frankfurter" },
      { currency: "USD", date: "2026-10-02", audPerUnit: 1.4411, source: "ECB via Frankfurter" },
      { currency: "USD", date: "2026-10-05", audPerUnit: 1.4367, source: "ECB via Frankfurter" },
    ]);
  });

  it("rejects a response without AUD rates instead of guessing", () => {
    expect(() => parseRangeResponse("USD", { base: "USD", rates: { "2026-10-01": {} } })).toThrow();
  });

  it("replay serves a recorded response and fails loudly on a miss", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fx-"));
    writeFileSync(join(dir, "USD_2026-10-01_2026-10-05.json"), JSON.stringify(BODY));
    const replay = new ReplayFxClient(dir);
    expect(await replay.getRates("USD", "2026-10-01", "2026-10-05")).toHaveLength(3);
    await expect(replay.getRates("EUR", "2026-10-01", "2026-10-05")).rejects.toThrow(
      /No recorded FX rates for EUR/,
    );
  });

  it("the cache stores fetched rates and serves them when the API is down", async () => {
    const db = openDb(":memory:");
    const dir = mkdtempSync(join(tmpdir(), "fx-"));
    writeFileSync(join(dir, "USD_2026-10-01_2026-10-05.json"), JSON.stringify(BODY));
    await new CachedFxClient(new ReplayFxClient(dir), db).getRates(
      "USD",
      "2026-10-01",
      "2026-10-05",
    );

    const fallbacks: string[] = [];
    const offline = new CachedFxClient(failing, db, (e) => fallbacks.push(e.code));
    const rates = await offline.getRates("USD", "2026-10-02", "2026-10-05");
    expect(rates.map((r) => r.date)).toEqual(["2026-10-02", "2026-10-05"]);
    expect(fallbacks).toEqual(["FX_API_ERROR"]);
  });

  it("with the API down and nothing cached, returns no rates (core then flags R-CUR-3)", async () => {
    const offline = new CachedFxClient(failing, openDb(":memory:"));
    expect(await offline.getRates("USD", "2026-10-01", "2026-10-05")).toEqual([]);
  });

  it("a missing replay recording is re-thrown, not treated as an outage", async () => {
    const empty = new ReplayFxClient(mkdtempSync(join(tmpdir(), "fx-")));
    const cached = new CachedFxClient(empty, openDb(":memory:"));
    await expect(cached.getRates("USD", "2026-10-01", "2026-10-05")).rejects.toThrow(
      /No recorded FX rates/,
    );
  });
});
