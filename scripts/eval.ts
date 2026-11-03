import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { openDb } from "@/adapters/db/client";
import { CachedFxClient } from "@/adapters/fx/cached";
import { FrankfurterFxClient, ReplayFxClient } from "@/adapters/fx/frankfurter";
import type { FxClient } from "@/adapters/fx/types";
import { createModelClient } from "@/adapters/model";
import type { ModelClient } from "@/adapters/model/types";
import { parseFormatA } from "@/adapters/statement/format-a";
import { parseEnv } from "@/config/env";
import type { CategoryConfig } from "@/core/categories";
import { FlatFxClient, OracleModelClient } from "@/pipeline/oracle";
import { configFromEnv, type MonthResult, runMonth } from "@/pipeline/run-month";
import { GroundTruth, Intake, Splits, TestCaseId } from "./dataset/schema";
import type { Ratio } from "./eval/score";
import { type SystemScore, scoreSystem } from "./eval/system";

// Usage:
//   pnpm eval -- --mode replay --label <name> [--cases TC01,TC02] [--ids R01,R02]
//   pnpm eval -- --mode live   --label <name>   (real API calls; records new fixtures)
//   pnpm eval -- --mode oracle --label <name>   (ground-truth fields: tests the rules alone)
// Writes eval-results/<label>/{summary.json, cases.csv, report.md}.

const ROOT = join(import.meta.dirname, "..");
const DATASET = join(ROOT, "fixtures", "dataset");

const { values } = parseArgs({
  // `pnpm eval -- --mode ...` passes the "--" through; drop it so the flags are read as flags.
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    mode: { type: "string", default: "replay" },
    label: { type: "string" },
    cases: { type: "string" },
    ids: { type: "string" },
  },
});
const mode = values.mode;
if (mode !== "replay" && mode !== "live" && mode !== "oracle") {
  throw new Error(`--mode must be replay, live, or oracle (got "${mode}").`);
}
if (!values.label || !/^[\w.-]+$/.test(values.label)) {
  throw new Error("--label is required: letters, digits, dot, dash, or underscore (e.g. v0-day2).");
}
const label = values.label;

if (existsSync(join(ROOT, ".env"))) process.loadEnvFile(join(ROOT, ".env"));
const env = parseEnv({
  ...process.env,
  MODE: mode === "live" ? "live" : "replay",
  RECORD: mode === "live" ? "1" : "0", // a live eval always records new fixtures
});

const read = (p: string) => readFileSync(join(DATASET, p), "utf8");
const intake = Intake.parse(JSON.parse(read("receipts.json")));
const truth = GroundTruth.parse(JSON.parse(read("ground-truth.json")));
const splits = Splits.parse(JSON.parse(read("splits.json")));
const lines = parseFormatA(read("statement-format-a.csv"));
const categories = JSON.parse(
  readFileSync(join(ROOT, "config", "categories.json"), "utf8"),
) as CategoryConfig;

// Which receipts to run.
const cases = values.cases ? values.cases.split(",").map((c) => TestCaseId.parse(c.trim())) : null;
const ids = values.ids ? new Set(values.ids.split(",").map((s) => s.trim())) : null;
const selected = truth.receipts.filter(
  (t) => (!cases || t.testCases.some((c) => cases.includes(c))) && (!ids || ids.has(t.id)),
);
if (selected.length === 0) throw new Error("No receipts match --cases / --ids.");
const selectedIds = new Set(selected.map((t) => t.id));
const fullSet = selected.length === truth.receipts.length;

// Clients for the mode.
const db = openDb(":memory:");
let model: ModelClient;
let fx: FxClient;
if (mode === "oracle") {
  model = new OracleModelClient(
    truth.receipts,
    new Map(intake.receipts.map((r) => [r.id, r.file.path.split("/").pop() ?? ""])),
  );
  fx = new FlatFxClient();
} else {
  model = createModelClient(env);
  const source =
    mode === "live" ? new FrankfurterFxClient(env.FX_BASE_URL, true) : new ReplayFxClient();
  fx = new CachedFxClient(source, db);
}

const config = configFromEnv(env, categories);
const runId = `${label}-${Date.now()}`;
console.log(`Running ${selected.length} receipt(s) in ${mode} mode as "${label}"...`);
const result: MonthResult = await runMonth(
  {
    monthKey: intake.monthKey,
    receipts: intake.receipts.filter((r) => selectedIds.has(r.id)),
    statementLines: lines,
    readFile: async (r) => readFileSync(join(DATASET, r.file.path)),
  },
  { model, fx, config, runId },
);

const score = scoreSystem(result, selected, truth, lines, config.matchPolicy, fullSet);
const holdoutTruth = selected.filter((t) => splits.holdout.includes(t.id));
const holdout =
  holdoutTruth.length > 0
    ? scoreSystem(result, holdoutTruth, truth, lines, config.matchPolicy, false)
    : null;

// Latency and tokens from the run log (meaningful in live mode only).
const perReceiptMs = new Map<string, number>();
let inputTokens = 0;
let outputTokens = 0;
for (const row of result.log) {
  inputTokens += row.inputTokens ?? 0;
  outputTokens += row.outputTokens ?? 0;
  if (row.receiptId)
    perReceiptMs.set(row.receiptId, (perReceiptMs.get(row.receiptId) ?? 0) + row.durationMs);
}
const sortedMs = [...perReceiptMs.values()].sort((a, b) => a - b);
const pctl = (p: number) =>
  sortedMs.length === 0
    ? null
    : (sortedMs[Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1)] ?? null);

let commit = "unknown";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
} catch {
  // not a git checkout
}

const summary = {
  label,
  mode,
  ranAt: new Date().toISOString(),
  commit,
  model: mode === "oracle" ? "oracle (ground-truth fields)" : env.MODEL_EXTRACT,
  reasoningEffort: env.MODEL_REASONING_EFFORT,
  policy: config.matchPolicy,
  receipts: selected.length,
  fullSet,
  testCasesRun: score.testCases.map((t) => t.testCase),
  metrics: { all: flatten(score), holdout: holdout ? flatten(holdout) : null },
  testCases: score.testCases,
  // Replay serves the latency and token counts recorded in the live run, so both are real
  // numbers from that run; the oracle makes no model calls, so neither applies.
  measuredFrom: mode === "live" ? "this run" : mode === "replay" ? "the recorded live run" : null,
  latencyMsPerReceipt: mode === "oracle" ? null : { p50: pctl(50), p95: pctl(95) },
  tokens: mode === "oracle" ? null : { input: inputTokens, output: outputTokens },
  cost: mode === "oracle" ? null : costOf(env.MODEL_EXTRACT, inputTokens, outputTokens),
};

// 06: price per token in config with its source and date. The run log does not split cached
// from uncached input, so this is an upper bound (all input at the full rate).
function costOf(modelId: string, input: number, output: number) {
  const pricing = JSON.parse(readFileSync(join(ROOT, "config", "pricing.json"), "utf8")) as {
    currency: string;
    models: Record<
      string,
      { inputPerMillion: number; outputPerMillion: number; source: string; checkedOn: string }
    >;
  };
  const price = pricing.models[modelId];
  if (!price) return { note: `not measured: no price for ${modelId} in config/pricing.json` };
  const total = (input * price.inputPerMillion + output * price.outputPerMillion) / 1_000_000;
  return {
    upperBound: Math.round(total * 10_000) / 10_000,
    perReceipt: Math.round((total / selected.length) * 10_000) / 10_000,
    currency: pricing.currency,
    basis: `${price.inputPerMillion}/M input, ${price.outputPerMillion}/M output; ${price.source}, ${price.checkedOn}`,
  };
}
const costLine = (() => {
  const c = summary.cost;
  if (!c) return "not applicable (oracle mode makes no model calls)";
  if ("note" in c) return c.note;
  return `at most ${c.currency} ${c.upperBound} (${c.currency} ${c.perReceipt} per receipt; upper bound, all input at the full rate; ${c.basis})`;
})();

function flatten(s: SystemScore) {
  return {
    extractionTotal: s.base.extraction.total,
    extractionCurrency: s.base.extraction.currency,
    extractionDate: s.base.extraction.date,
    extractionVendor: s.base.extraction.vendor,
    categoryAccuracy: s.base.category,
    matchRecallTop1: s.matchRecallTop1,
    wrongAutoMatchRate: s.wrongAutoMatchRate,
    headlineExceptionRecall: s.base.headlineExceptionRecall,
    exceptionRecall: s.base.exceptionRecall,
    exceptionPrecision: s.base.exceptionPrecision,
    humanTouches: s.humanTouches,
    noReceiptLineRecall: s.noReceiptLineRecall,
  };
}

const pct = (r: Ratio | null | undefined) =>
  !r || r.rate === null ? "n/a" : `${r.hit}/${r.of} (${(r.rate * 100).toFixed(0)}%)`;

const truthById = new Map(truth.receipts.map((t) => [t.id, t]));
const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = [
  "receipt_id,test_cases,split,expected_status,status,expected_line,auto_line,top_candidate,expected_exceptions,exceptions,expected_category,category,total_ok,currency_ok,date_ok,vendor_ok",
  ...result.receipts.map((r) => {
    const t = truthById.get(r.id);
    const c = score.base.cases.find((x) => x.receiptId === r.id);
    return [
      r.id,
      t?.testCases.join(" "),
      splits.holdout.includes(r.id) ? "holdout" : "tuning",
      t?.matchStatus,
      r.state.status,
      t?.statementLineId,
      r.state.status === "matched" ? r.match?.statementLineId : "",
      r.match?.candidates[0]?.statementLineId,
      t?.exceptions.join(" "),
      r.state.exceptions.join(" "),
      t?.category,
      r.category?.category,
      c?.totalOk,
      c?.currencyOk,
      c?.dateOk,
      c?.vendorOk,
    ]
      .map(csvCell)
      .join(",");
  }),
].join("\n");

const metricRows: [string, (s: ReturnType<typeof flatten>) => Ratio | null | undefined][] = [
  ["Extraction: total", (m) => m.extractionTotal],
  ["Extraction: currency", (m) => m.extractionCurrency],
  ["Extraction: date", (m) => m.extractionDate],
  ["Extraction: vendor", (m) => m.extractionVendor],
  ["Category accuracy (before review)", (m) => m.categoryAccuracy],
  ["Match recall (auto-match or top-1 candidate)", (m) => m.matchRecallTop1],
  ["Wrong auto-match rate", (m) => m.wrongAutoMatchRate],
  ["Exception recall (amount, purpose, duplicate)", (m) => m.headlineExceptionRecall],
  ["Human touches (receipts not bulk-approvable)", (m) => m.humanTouches],
  ["No-receipt line recall (full set only)", (m) => m.noReceiptLineRecall],
];
const all = summary.metrics.all;
const ho = summary.metrics.holdout;
const report = [
  `# Eval run \`${label}\``,
  "",
  `Mode **${mode}**, model \`${summary.model}\` (effort ${summary.reasoningEffort}), commit \`${commit}\`, ${summary.ranAt}.`,
  `Receipts evaluated: ${selected.length} of ${truth.receipts.length}${fullSet ? " (full set)" : cases ? ` (cases ${cases.join(", ")})` : ""}.`,
  mode === "oracle"
    ? "\n> Oracle mode: the model returns the ground-truth fields, so this measures the rules and pipeline alone, not perception.\n"
    : "",
  "## Test cases (pass only if every expected behaviour holds)",
  "",
  "| TC | Receipts | Result |",
  "|---|---|---|",
  ...score.testCases.map(
    (t) => `| ${t.testCase} | ${t.receipts.join(", ")} | ${t.pass ? "PASS" : "FAIL"} |`,
  ),
  "",
  "## Metrics",
  "",
  "| Metric | Evaluated set | Holdout part |",
  "|---|---|---|",
  ...metricRows.map(
    ([name, pick]) => `| ${name} | ${pct(pick(all))} | ${ho ? pct(pick(ho)) : "n/a"} |`,
  ),
  "",
  `Latency per receipt (model time, from ${summary.measuredFrom ?? "no model calls"}): ${summary.latencyMsPerReceipt ? `p50 ${summary.latencyMsPerReceipt.p50} ms, p95 ${summary.latencyMsPerReceipt.p95} ms` : "not applicable (oracle mode)"}.`,
  `Tokens: ${summary.tokens ? `${summary.tokens.input} input, ${summary.tokens.output} output` : "not applicable (oracle mode)"}.`,
  `Cost: ${costLine}.`,
  "",
  "## Every failed assertion",
  "",
  ...(score.testCases.some((t) => !t.pass)
    ? score.testCases.flatMap((t) => t.failures.map((f) => `- ${t.testCase} ${f}`))
    : ["None."]),
  "",
].join("\n");

const out = join(ROOT, "eval-results", label);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(join(out, "cases.csv"), `${csv}\n`);
writeFileSync(join(out, "report.md"), report);
const passed = score.testCases.filter((t) => t.pass).length;
console.log(
  `Test cases: ${passed}/${score.testCases.length} pass. Wrong auto-match rate: ${pct(all.wrongAutoMatchRate)}.`,
);
console.log(`Wrote eval-results/${label}/{summary.json, cases.csv, report.md}`);
