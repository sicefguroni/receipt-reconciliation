import { describe, expect, it } from "vitest";
import { isSpecificReason, reasonProblem } from "./reasons";

describe("reasons a person gives (Day 4, C1)", () => {
  it("a short or generic reason is refused, and says why", () => {
    expect(reasonProblem("Good")).toBe("at least 8 characters");
    expect(reasonProblem("Looks good, ok")).toBe('saying what happened, not just "good" or "ok"');
    expect(reasonProblem("Approved")).toBe('saying what happened, not just "good" or "ok"');
  });

  it("a reason that says something is accepted, whatever its case", () => {
    expect(isSpecificReason("Bank fee")).toBe(true);
    expect(isSpecificReason("Tip added at the table")).toBe(true);
    expect(isSpecificReason("Deposit paid at booking, balance at checkout")).toBe(true);
  });
});
