import { describe, expect, it } from "vitest";
import { accountMatchesSource, checkBusinessPurpose, paymentSourceLabel } from "./required";

describe("R-REQ required-information rules", () => {
  it("R-REQ-1: a blank or missing business purpose flags MISSING_PURPOSE (TC06)", () => {
    expect(checkBusinessPurpose("")).toEqual(["MISSING_PURPOSE"]);
    expect(checkBusinessPurpose("   ")).toEqual(["MISSING_PURPOSE"]);
    expect(checkBusinessPurpose(undefined)).toEqual(["MISSING_PURPOSE"]);
    expect(checkBusinessPurpose(null)).toEqual(["MISSING_PURPOSE"]);
  });

  it("R-REQ-1: placeholder text such as 'n/a', '-', or 'none' flags MISSING_PURPOSE (E4)", () => {
    for (const placeholder of ["n/a", "N/A", "-", "none", "None ", "na", "nil"]) {
      expect(checkBusinessPurpose(placeholder), placeholder).toEqual(["MISSING_PURPOSE"]);
    }
  });

  it("R-REQ-1: a real purpose passes, even a short one", () => {
    expect(checkBusinessPurpose("Coffee with prospective client")).toEqual([]);
    expect(checkBusinessPurpose("Taxi")).toEqual([]);
  });

  it("R-REQ-2: an unknown payment source is shown with a prompt to set it (E8)", () => {
    expect(paymentSourceLabel("unknown")).toBe("Unknown — set payment source");
    expect(paymentSourceLabel("company_card")).toBe("Company card");
  });

  it("R-REQ-3: bank is a payment source and matches bank statement lines", () => {
    expect(paymentSourceLabel("bank")).toBe("Bank account");
    expect(accountMatchesSource("bank", "bank")).toBe(true);
    expect(accountMatchesSource("bank", "company_card")).toBe(false);
    expect(accountMatchesSource("company_card", "company_card")).toBe(true);
  });

  it("R-REQ-3: an unknown source never earns the account point", () => {
    for (const account of ["company_card", "personal_card", "bank"] as const) {
      expect(accountMatchesSource("unknown", account)).toBe(false);
    }
  });
});
