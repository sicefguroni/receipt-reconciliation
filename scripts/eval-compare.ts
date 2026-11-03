import { readFileSync } from "node:fs";
import { join } from "node:path";

// Usage: pnpm eval:compare -- <labelA> <labelB>
// Prints metric deltas between two eval runs, regressions included (06, "Regression protocol").

const ROOT = join(import.meta.dirname, "..");
const [a, b] = process.argv.slice(2).filter((x) => x !== "--");
if (!a || !b) throw new Error("Usage: pnpm eval:compare -- <labelA> <labelB>");

interface Ratio {
  hit: number;
  of: number;
  rate: number | null;
}
interface Summary {
  label: string;
  mode: string;
  receipts: number;
  metrics: { all: Record<string, Ratio | Record<string, Ratio> | null> };
  testCases: { testCase: string; pass: boolean }[];
}

const load = (label: string): Summary =>
  JSON.parse(readFileSync(join(ROOT, "eval-results", label, "summary.json"), "utf8")) as Summary;
const A = load(a);
const B = load(b);

// For these, lower is better.
const LOWER_IS_BETTER = new Set(["wrongAutoMatchRate", "humanTouches"]);
const isRatio = (v: unknown): v is Ratio =>
  typeof v === "object" && v !== null && "hit" in v && "of" in v;
const fmt = (r: Ratio | undefined) =>
  !r || r.rate === null ? "n/a" : `${r.hit}/${r.of} (${(r.rate * 100).toFixed(0)}%)`;

const rows = [`| Metric | ${a} | ${b} | Change |`, "|---|---|---|---|"];
for (const key of Object.keys(A.metrics.all)) {
  const x = A.metrics.all[key];
  const y = B.metrics.all[key];
  if (!isRatio(x) && !isRatio(y)) continue;
  const before = isRatio(x) ? x : undefined;
  const after = isRatio(y) ? y : undefined;
  let change = "n/a";
  if (before?.rate != null && after?.rate != null) {
    const delta = (after.rate - before.rate) * 100;
    const better = LOWER_IS_BETTER.has(key) ? delta < 0 : delta > 0;
    change =
      delta === 0
        ? "same"
        : `${delta > 0 ? "+" : ""}${delta.toFixed(0)} pts ${better ? "(better)" : "(REGRESSION)"}`;
  }
  rows.push(`| ${key} | ${fmt(before)} | ${fmt(after)} | ${change} |`);
}
rows.push("", `| Test case | ${a} | ${b} |`, "|---|---|---|");
const tcs = [...new Set([...A.testCases, ...B.testCases].map((t) => t.testCase))].sort();
for (const tc of tcs) {
  const s = (x: Summary) => {
    const t = x.testCases.find((c) => c.testCase === tc);
    return t ? (t.pass ? "PASS" : "FAIL") : "not run";
  };
  rows.push(`| ${tc} | ${s(A)} | ${s(B)} |`);
}
console.log(`${a}: ${A.mode}, ${A.receipts} receipts. ${b}: ${B.mode}, ${B.receipts} receipts.\n`);
console.log(rows.join("\n"));
