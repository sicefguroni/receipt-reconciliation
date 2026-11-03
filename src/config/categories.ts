import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { CategoryConfig } from "@/core/categories";

// config/categories.json (05, R-CAT): the chart and the vendor keyword table.
const CategoryFile = z
  .object({
    categories: z.array(z.string().trim().min(1)).min(2),
    rules: z.array(z.object({ keyword: z.string().trim().min(1), category: z.string() })),
  })
  .superRefine((file, ctx) => {
    for (const [i, rule] of file.rules.entries()) {
      if (!file.categories.includes(rule.category)) {
        ctx.addIssue({
          code: "custom",
          path: ["rules", i, "category"],
          message: `"${rule.category}" is not in the categories list.`,
        });
      }
    }
  });

export function loadCategoryConfig(
  path = join(process.cwd(), "config", "categories.json"),
): CategoryConfig {
  // Read at runtime so a changed rule table applies without a rebuild (R-CAT-4).
  const parsed = CategoryFile.safeParse(
    JSON.parse(readFileSync(/*turbopackIgnore: true*/ path, "utf8")),
  );
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `config/categories.json has a problem at ${issue?.path.join(".")}: ${issue?.message}`,
    );
  }
  return parsed.data;
}
