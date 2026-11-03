import { describe, expect, it } from "vitest";
import { type ApprovalSubject, checkApproval, isBulkApprovable } from "./approvals";

const clean: ApprovalSubject = { submitterId: "S1", status: "matched", exceptions: [] };

describe("R-APR approval rules", () => {
  it("R-APR-1: the submitter cannot approve their own receipt, and is told why", () => {
    expect(checkApproval(clean, "S1")).toEqual({
      allowed: false,
      code: "SELF_APPROVAL_BLOCKED",
      reason: "You submitted this receipt, so someone else must approve it.",
    });
  });

  it("R-APR-1: another reviewer can approve a clean item", () => {
    expect(checkApproval(clean, "REVIEWER")).toEqual({ allowed: true });
  });

  it("R-APR-2: each blocking exception prevents approval until resolved", () => {
    for (const code of [
      "MISSING_PURPOSE",
      "DUPLICATE",
      "UNREADABLE",
      "NOT_A_RECEIPT",
      "AMBIGUOUS_MATCH",
      "NO_PAYMENT_FOUND",
    ] as const) {
      expect(checkApproval({ ...clean, exceptions: [code] }, "REVIEWER")).toMatchObject({
        allowed: false,
        code,
      });
    }
  });

  it("R-APR-2: an over-threshold difference blocks until signed off with a reason (R-AMT-4, TC04)", () => {
    const differs: ApprovalSubject = {
      ...clean,
      status: "amount_differs",
      exceptions: ["AMOUNT_DIFFERS_OVER_THRESHOLD"],
    };
    expect(checkApproval(differs, "REVIEWER").allowed).toBe(false);
    expect(checkApproval({ ...differs, signOffReason: "ok" }, "REVIEWER").allowed).toBe(false);
    expect(
      checkApproval({ ...differs, signOffReason: "Extra hinge part" }, "REVIEWER").allowed,
    ).toBe(true);
  });

  it("R-APR-2: non-blocking flags (low confidence, unknown category) can still be approved one by one", () => {
    const flagged = { ...clean, exceptions: ["LOW_CONFIDENCE_FIELD", "UNKNOWN_CATEGORY"] as const };
    expect(checkApproval({ ...flagged, exceptions: [...flagged.exceptions] }, "REVIEWER")).toEqual({
      allowed: true,
    });
  });

  it("R-APR-3: bulk approve covers only matched items with no exceptions", () => {
    expect(isBulkApprovable(clean)).toBe(true);
    expect(isBulkApprovable({ status: "matched", exceptions: ["LOW_CONFIDENCE_FIELD"] })).toBe(
      false,
    );
    expect(isBulkApprovable({ status: "matched", exceptions: ["MISSING_PURPOSE"] })).toBe(false);
    expect(isBulkApprovable({ status: "unmatched", exceptions: [] })).toBe(false); // reimbursement
    expect(isBulkApprovable({ status: "amount_differs", exceptions: [] })).toBe(false);
  });
});
