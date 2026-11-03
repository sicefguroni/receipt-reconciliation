import { describe, expect, it } from "vitest";
import { openDb } from "./client";
import { fxRate, monthRun, runLog } from "./schema";

describe("openDb", () => {
  it("applies the migrations and round-trips a run_log row", () => {
    const db = openDb(":memory:");
    db.insert(runLog)
      .values({ runId: "r1", stage: "extract", status: "ok", durationMs: 12, at: "2026-11-02" })
      .run();
    const rows = db.select().from(runLog).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.stage).toBe("extract");
  });

  it("creates the fx_rate and month_run tables", () => {
    const db = openDb(":memory:");
    db.insert(fxRate)
      .values({
        currency: "USD",
        date: "2026-10-02",
        audPerUnit: 1.4411,
        source: "t",
        fetchedAt: "x",
      })
      .run();
    db.insert(monthRun)
      .values({
        id: "run1",
        monthKey: "2026-10",
        mode: "replay",
        startedAt: "a",
        finishedAt: "b",
        resultJson: "{}",
      })
      .run();
    expect(db.select().from(fxRate).all()).toHaveLength(1);
    expect(db.select().from(monthRun).all()).toHaveLength(1);
  });
});
