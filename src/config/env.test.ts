import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("works with no variables at all (replay mode, policy defaults)", () => {
    const env = parseEnv({});
    expect(env.MODE).toBe("replay");
    expect(env.AMOUNT_DIFF_PCT_THRESHOLD).toBe(10);
    expect(env.AMOUNT_DIFF_AUD_THRESHOLD).toBe(100);
    expect(env.AUTO_MATCH_MIN_SCORE).toBe(75);
    expect(env.AUTO_MATCH_MIN_MARGIN).toBe(20);
  });

  it("treats blank values as unset", () => {
    const env = parseEnv({ ANTHROPIC_API_KEY: "", AMOUNT_DIFF_PCT_THRESHOLD: "  " });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.AMOUNT_DIFF_PCT_THRESHOLD).toBe(10);
  });

  it("coerces numeric thresholds from strings", () => {
    const env = parseEnv({ AMOUNT_DIFF_PCT_THRESHOLD: "7.5", AUTO_MATCH_MIN_SCORE: "80" });
    expect(env.AMOUNT_DIFF_PCT_THRESHOLD).toBe(7.5);
    expect(env.AUTO_MATCH_MIN_SCORE).toBe(80);
  });

  it("refuses live mode without an API key, with a fix in the message", () => {
    expect(() => parseEnv({ MODE: "live" })).toThrow(/MODE=live needs ANTHROPIC_API_KEY/);
  });

  it("refuses RECORD=1 outside live mode", () => {
    expect(() => parseEnv({ RECORD: "1" })).toThrow(/RECORD=1 only works with MODE=live/);
  });

  it("rejects a non-numeric threshold", () => {
    expect(() => parseEnv({ AMOUNT_DIFF_AUD_THRESHOLD: "a hundred" })).toThrow(
      /AMOUNT_DIFF_AUD_THRESHOLD/,
    );
  });
});
