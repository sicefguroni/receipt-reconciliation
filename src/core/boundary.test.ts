import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// docs/sprint/04-system-design.md, "Boundary rule": src/core is pure. It imports
// nothing from adapters, pipeline, config, or the UI, and does no I/O.
// This test enforces that so the rule is checked, not just documented.
const CORE_DIR = join(import.meta.dirname, ".");

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /from\s+["'](@\/|\.\.\/)(adapters|pipeline|app|config)\b/, why: "layer import" },
  { pattern: /from\s+["']node:/, why: "Node built-in (I/O)" },
  { pattern: /from\s+["'](fs|path|http|https|child_process|net)["']/, why: "Node built-in (I/O)" },
  { pattern: /from\s+["'](next|react|better-sqlite3|drizzle-orm)/, why: "framework or storage" },
  { pattern: /\bprocess\.env\b/, why: "reads environment (pass config in instead)" },
  { pattern: /\bfetch\s*\(/, why: "network I/O" },
];

function coreSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return coreSourceFiles(full);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [full] : [];
  });
}

describe("src/core boundary", () => {
  it("has no imports from other layers and no I/O", () => {
    const violations = coreSourceFiles(CORE_DIR).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return FORBIDDEN.filter(({ pattern }) => pattern.test(source)).map(
        ({ why }) => `${file}: ${why}`,
      );
    });
    expect(violations).toEqual([]);
  });
});
