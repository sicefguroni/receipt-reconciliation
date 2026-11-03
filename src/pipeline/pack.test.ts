import { describe, expect, it } from "vitest";
import { csvCell } from "./pack";

describe("ledger CSV cells", () => {
  it("neutralises spreadsheet formulas in untrusted text (vendor names come from the model)", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("+61 Cafe")).toBe("'+61 Cafe");
    expect(csvCell("@vendor")).toBe("'@vendor");
  });

  it("keeps plain numbers, including negatives, numeric", () => {
    expect(csvCell("-12.40")).toBe("-12.40");
    expect(csvCell(18.5)).toBe("18.5");
  });

  it("quotes commas and quotes, and writes nothing for empty values", () => {
    expect(csvCell("Ham & cheese, croissant")).toBe('"Ham & cheese, croissant"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});
