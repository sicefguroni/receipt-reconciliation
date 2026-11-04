import { normaliseVendor } from "./duplicates";
import { distinctiveSimilarity } from "./matching";
import type { CategorySource, ExceptionCode } from "./schemas";

// Category rules R-CAT-1 to R-CAT-5 (docs/sprint/05-business-rules.md).
// The chart and the keyword table live in config/categories.json and are passed in.

export const OTHER = "Other";

export interface VendorRule {
  keyword: string;
  category: string;
}

export interface CategoryConfig {
  /** R-CAT-5: displayed exactly as written here, never as slugs. */
  categories: readonly string[];
  rules: readonly VendorRule[];
}

export interface CategoryResult {
  category: string | null;
  source: CategorySource;
  confidence: number;
  /** Why: the keyword that hit (rule), or the model's own reason. */
  reason: string;
  exceptions: ExceptionCode[];
}

function normalise(text: string): string {
  return normaliseVendor(text);
}

function hits(text: string, keyword: string): boolean {
  // Whole-word start: "repair" hits "repairs", but "ads" does not hit "roads".
  const k = normalise(keyword);
  return k !== "" && ` ${normalise(text)}`.includes(` ${k}`);
}

/**
 * R-CAT-1: the rule table is applied first; a keyword hit gives source `rule`, confidence 1.0.
 * The vendor name is checked before the extracted item summary, because one vendor (a
 * hardware store) can sell items in different categories. The first rule in table order wins.
 */
export function categoriseByRules(
  vendor: string | null,
  summary: string | null,
  rules: readonly VendorRule[],
): CategoryResult | null {
  for (const [text, where] of [
    [vendor, "vendor"],
    [summary, "items"],
  ] as const) {
    if (!text) continue;
    const rule = rules.find((r) => hits(text, r.keyword));
    if (rule) {
      return {
        category: rule.category,
        source: "rule",
        confidence: 1,
        reason: `${where} matches the rule "${rule.keyword}"`,
        exceptions: [],
      };
    }
  }
  return null;
}

/** R-CAT-2 / R-CAT-3: the list the model may choose from. Never includes "Other". */
export function modelChoices(config: CategoryConfig): string[] {
  return config.categories.filter((c) => c !== OTHER);
}

/**
 * R-CAT-2: with no rule hit, the model picks from the configured list and gives a reason;
 * confidence below the minimum flags UNKNOWN_CATEGORY.
 * R-CAT-3: the model may never choose "Other" (or anything off the list): that is treated as
 * no answer, so a person picks.
 */
export function acceptModelCategory(
  guess: { category: string; confidence: number; reason: string },
  config: CategoryConfig,
  minConfidence: number,
): CategoryResult {
  const allowed = modelChoices(config).includes(guess.category);
  if (!allowed || guess.confidence < minConfidence) {
    return {
      category: allowed ? guess.category : null, // kept as a suggestion, still flagged
      source: "model",
      confidence: guess.confidence,
      reason: guess.reason,
      exceptions: ["UNKNOWN_CATEGORY"],
    };
  }
  return {
    category: guess.category,
    source: "model",
    confidence: guess.confidence,
    reason: guess.reason,
    exceptions: [],
  };
}

/**
 * R-CAT-4: "Always use this category for <vendor>" appends a rule for the normalised vendor
 * name. The new rule goes first, so it overrides a broader keyword. The caller records the
 * human decision that caused it.
 */
export function addVendorRule(
  rules: readonly VendorRule[],
  vendor: string,
  category: string,
  config: CategoryConfig,
): VendorRule[] {
  if (!config.categories.includes(category)) {
    throw new Error(`"${category}" is not one of the configured categories.`);
  }
  const keyword = normalise(vendor);
  if (!keyword) throw new Error("A vendor rule needs a vendor name.");
  return [{ keyword, category }, ...rules.filter((r) => normalise(r.keyword) !== keyword)];
}

export interface LineCategorySuggestion {
  category: string;
  /** Why, in plain words, for the person: "the description matches the rule \"taxi\"". */
  why: string;
}

/**
 * R-CAT-6 (Day 4, after both cold runs put substitutes in odd categories: a café under Rent,
 * an app store under Repairs): the category a statement line with no receipt most likely
 * belongs to. The rule table first, on the line's description; otherwise the category of this
 * month's receipts from the same business (distinctive words, R-MAT-11), the most common one.
 * Null when neither knows: then nothing can be checked.
 */
export function suggestLineCategory(
  description: string,
  receipts: readonly { id: string; vendor: string | null; category: string | null }[],
  rules: readonly VendorRule[],
): LineCategorySuggestion | null {
  const rule = rules.find((r) => hits(description, r.keyword));
  if (rule) {
    return { category: rule.category, why: `the description matches the rule "${rule.keyword}"` };
  }
  const byCategory = new Map<string, string[]>();
  for (const r of receipts) {
    if (!r.vendor || !r.category || distinctiveSimilarity(r.vendor, description) < 0.6) continue;
    byCategory.set(r.category, [...(byCategory.get(r.category) ?? []), r.id]);
  }
  const best = [...byCategory.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  )[0];
  if (!best) return null;
  const [category, ids] = best;
  return {
    category,
    why: `${ids.join(", ")} from the same business ${ids.length > 1 ? "are" : "is"} ${category}`,
  };
}
