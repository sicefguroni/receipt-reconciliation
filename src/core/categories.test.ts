import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acceptModelCategory,
  addVendorRule,
  type CategoryConfig,
  categoriseByRules,
  modelChoices,
} from "./categories";
import { DEFAULT_CATEGORIES } from "./schemas";

const config = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../config/categories.json"), "utf8"),
) as CategoryConfig;

describe("R-CAT category rules", () => {
  it("R-CAT-1: a vendor keyword hit gives source rule with confidence 1.0", () => {
    expect(categoriseByRules("Metro Taxi Co.", null, config.rules)).toMatchObject({
      category: "Travel",
      source: "rule",
      confidence: 1,
      exceptions: [],
    });
  });

  it("R-CAT-1: keywords match whole-word starts, case and accents ignored", () => {
    expect(categoriseByRules("Sample Café", null, config.rules)?.category).toBe(
      "Meals & Entertainment",
    );
    expect(categoriseByRules("QuickFix Repairs", null, config.rules)?.category).toBe(
      "Repairs & Maintenance",
    );
    expect(categoriseByRules("Sample Roads Pty Ltd", null, config.rules)).toBeNull(); // not "ads"
  });

  it("R-CAT-1: the vendor is checked before the item summary", () => {
    // A coworking pass that mentions a desk is Rent & Workspace, not Equipment.
    expect(categoriseByRules("Hub Coworking", "Desk space, one day", config.rules)?.category).toBe(
      "Rent & Workspace",
    );
  });

  it("R-CAT-1: a vendor with no keyword falls back to the item summary (TC12 office chair)", () => {
    expect(
      categoriseByRules("Ironbark Hardware", "Ergonomic office chair", config.rules),
    ).toMatchObject({ category: "Equipment", reason: 'items matches the rule "chair"' });
  });

  it("R-CAT-1: no hit at all returns null, so the model is asked", () => {
    expect(categoriseByRules("Demo Cloud Pty Ltd", "Hosting", config.rules)).toBeNull();
  });

  it("R-CAT-2: a confident model answer from the list is accepted with its reason", () => {
    const r = acceptModelCategory(
      { category: "AI & Cloud", confidence: 0.92, reason: "cloud hosting invoice" },
      config,
      0.7,
    );
    expect(r).toMatchObject({ category: "AI & Cloud", source: "model", exceptions: [] });
  });

  it("R-CAT-2: confidence below 0.7 flags UNKNOWN_CATEGORY but keeps the suggestion", () => {
    const r = acceptModelCategory(
      { category: "Software", confidence: 0.55, reason: "unclear" },
      config,
      0.7,
    );
    expect(r).toMatchObject({ category: "Software", exceptions: ["UNKNOWN_CATEGORY"] });
  });

  it("R-CAT-3: the model's choice list never includes Other", () => {
    expect(modelChoices(config)).not.toContain("Other");
    expect(modelChoices(config)).toHaveLength(config.categories.length - 1);
  });

  it("R-CAT-3: if the model answers Other anyway, it is no answer and a person picks", () => {
    const r = acceptModelCategory(
      { category: "Other", confidence: 0.99, reason: "x" },
      config,
      0.7,
    );
    expect(r).toMatchObject({ category: null, exceptions: ["UNKNOWN_CATEGORY"] });
  });

  it("R-CAT-3: an off-list answer is treated the same way", () => {
    const r = acceptModelCategory(
      { category: "ai cloud", confidence: 0.99, reason: "x" },
      config,
      0.7,
    );
    expect(r).toMatchObject({ category: null, exceptions: ["UNKNOWN_CATEGORY"] });
  });

  it("R-CAT-4: 'Always use this category for <vendor>' adds a rule that wins next time", () => {
    const rules = addVendorRule(config.rules, "Demo Cloud Pty Ltd", "AI & Cloud", config);
    expect(categoriseByRules("DEMO CLOUD", null, rules)).toMatchObject({
      category: "AI & Cloud",
      source: "rule",
    });
    expect(rules).toHaveLength(config.rules.length + 1);
  });

  it("R-CAT-4: a vendor rule overrides a broader keyword and is not duplicated", () => {
    const once = addVendorRule(config.rules, "Sample Café", "Office Supplies", config);
    const twice = addVendorRule(once, "SAMPLE CAFE", "Office Supplies", config);
    expect(categoriseByRules("Sample Café", null, twice)?.category).toBe("Office Supplies");
    expect(twice).toHaveLength(config.rules.length + 1);
  });

  it("R-CAT-4: a rule can only point at a configured category", () => {
    expect(() => addVendorRule(config.rules, "Demo Cloud", "Cloud Stuff", config)).toThrow(
      /not one of the configured categories/,
    );
  });

  it("R-CAT-5: configured names are kept exactly as written (no slug forms)", () => {
    expect(config.categories).toEqual([...DEFAULT_CATEGORIES]);
    for (const rule of config.rules) expect(config.categories).toContain(rule.category);
  });
});
