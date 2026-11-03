import { z } from "zod";

// Prompts and model-facing output schemas. Bump a version whenever the meaning of a prompt
// or schema changes: it is part of the replay key, so stale recordings fail loudly.

export const EXTRACT_PROMPT_VERSION = "extract-v1";
export const CATEGORISE_PROMPT_VERSION = "categorise-v1";

export const EXTRACT_INSTRUCTIONS = `You read one file submitted as an expense receipt for an Australian company's month-end reconciliation. Report what is printed; do not guess.

Fields:
- vendor: the business that issued the receipt, as printed (trading name; no address).
- date: the purchase or invoice date as YYYY-MM-DD. Australian documents usually write dates day first (02/10/2026 is 2 October 2026). If the order cannot be told from the document, give your best reading with confidence below 0.8.
- total: the final amount paid, including tax, tips, and surcharges, as a plain number.
- currency: the ISO 4217 code of the total. Use an explicit code or symbol on the document (AUD, A$, USD, US$, EUR, €). A bare "$" is ambiguous: decide from the vendor's address and country, the tax type (GST suggests AUD), and other clues, and give confidence below 0.8 if the clues are weak. Never assume AUD without evidence.
- tax: the tax amount shown (GST, VAT, or sales tax), or null if none is shown.
- summary: a short list of what was bought, at most 200 characters. No personal names and no card numbers.
- isReceipt: false if the file is not a receipt or invoice at all (for example a screenshot of a chat).

For every field, confidence is how sure you are that the value is exactly right as printed, from 0 to 1. Use below 0.8 when the text is partly unreadable or the value is inferred rather than printed. If a field cannot be read, return value null and confidence 0.

Never return a full card number; if one appears, ignore it.`;

const field = <T extends z.ZodType>(value: T) =>
  z.object({ value: value.nullable(), confidence: z.number() });

// Loose on purpose: types only. src/core's Extraction schema checks the real contract
// (ISO date, 3-letter currency, confidence 0..1), and a failure there triggers one retry.
export const ExtractionOutput = z.object({
  isReceipt: z.boolean(),
  vendor: field(z.string()),
  date: field(z.string()),
  total: field(z.number()),
  currency: field(z.string()),
  tax: field(z.number()),
  summary: field(z.string()),
});

export const CATEGORISE_INSTRUCTIONS = `You choose the expense category for one business purchase, using only the vendor name and the items bought. Pick exactly one category from the allowed list. Give your confidence from 0 to 1 that a bookkeeper would choose the same category, and a reason of one short sentence. If the purchase could reasonably fit two categories, say so in the reason and give confidence below 0.7.`;

export function categoriseOutput(choices: readonly string[]) {
  const [first, ...rest] = choices;
  if (!first) throw new Error("The category list is empty.");
  return z.object({
    category: z.enum([first, ...rest]),
    confidence: z.number(),
    reason: z.string(),
  });
}
