import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { openDb } from "@/adapters/db/client";
import { CachedFxClient } from "@/adapters/fx/cached";
import { FrankfurterFxClient, ReplayFxClient } from "@/adapters/fx/frankfurter";
import { type FxClient, FxError } from "@/adapters/fx/types";
import { createModelClient } from "@/adapters/model";
import { readStatement, StatementFormatError } from "@/adapters/statement/read-statement";
import { parseEnv } from "@/config/env";
import type { CategoryConfig } from "@/core/categories";
import type { FxRate } from "@/core/currency";
import type { StatementLine } from "@/core/schemas";
import {
  configFromEnv,
  type MonthResult,
  type ReceiptResult,
  runMonth,
} from "@/pipeline/run-month";
import { GroundTruth, Intake } from "./dataset/schema";

// Usage:
//   pnpm eval:stress -- --mode replay --label <name>   (no API key)
//   pnpm eval:stress -- --mode live   --label <name>   (records the stress receipts' model calls)
//   add --ids S03 to run only those stress receipts (to record one without re-rolling the rest)
// Runs the Day 4 stress set (06, "Stress cases for Day 4") and checks each case for *safe
// failure*. Writes eval-results/<label>/{summary.json, report.md}. S09 and S10 reuse the
// October data and never call the model live.

const ROOT = join(import.meta.dirname, "..");
const STRESS = join(ROOT, "fixtures", "stress");
const DATASET = join(ROOT, "fixtures", "dataset");

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    mode: { type: "string", default: "replay" },
    label: { type: "string" },
    ids: { type: "string" },
  },
});
const mode = values.mode;
if (mode !== "replay" && mode !== "live")
  throw new Error(`--mode must be replay or live (got "${mode}").`);
if (!values.label || !/^[\w.-]+$/.test(values.label)) {
  throw new Error("--label is required: letters, digits, dot, dash, or underscore.");
}
const label = values.label;

if (existsSync(join(ROOT, ".env"))) process.loadEnvFile(join(ROOT, ".env"));
const env = parseEnv({ ...process.env, MODE: mode, RECORD: mode === "live" ? "1" : "0" });
const replayEnv = parseEnv({ ...process.env, MODE: "replay", RECORD: "0" });
const categories = JSON.parse(
  readFileSync(join(ROOT, "config", "categories.json"), "utf8"),
) as CategoryConfig;
const config = configFromEnv(env, categories);

const StressTruth = z.object({
  monthKey: z.string(),
  receipts: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      stress: z.string(),
      expect: z.string(),
      truth: z.object({
        isReceipt: z.boolean(),
        vendor: z.string(),
        date: z.string(),
        total: z.number(),
        currency: z.string(),
        lineIds: z.array(z.string()),
      }),
    }),
  ),
});
type StressCase = z.infer<typeof StressTruth>["receipts"][number];

interface CaseResult {
  id: string;
  title: string;
  stress: string;
  expect: string;
  pass: boolean;
  /** correct: right answer. safe: wrong or unsure, but a person is asked. failure: neither. */
  outcome: "correct" | "safe" | "failure";
  observed: string[];
  failures: string[];
}

// ---------- helpers over a reconciled month ----------

function groupOf(result: MonthResult, id: string): number | "done" {
  for (const section of result.queue) {
    if (section.items.some((item) => item.id === id)) return section.group;
  }
  return "done";
}

/** In group 5 with nothing open: a person could approve it in bulk without opening it. */
function bulkApprovable(result: MonthResult, r: ReceiptResult): boolean {
  return groupOf(result, r.id) === 5 && r.openExceptions.length === 0;
}

const FIELDS = ["total", "date", "currency"] as const;

/** Fields read wrong but with confidence at or above the minimum: the silent failure. */
function confidentlyWrong(r: ReceiptResult, t: StressCase["truth"]): string[] {
  const e = r.extraction;
  if (!e) return [];
  return FIELDS.filter((f) => {
    const field = e[f];
    const wrong =
      f === "total"
        ? field.value === null || Math.abs(Number(field.value) - t.total) > 0.01
        : String(field.value ?? "").toUpperCase() !== t[f].toUpperCase();
    return (
      wrong && !r.lowConfidenceFields.includes(f) && field.confidence >= config.extractConfidenceMin
    );
  });
}

function describe(result: MonthResult, r: ReceiptResult): string[] {
  const e = r.extraction;
  const read = e
    ? FIELDS.map((f) => `${f} ${JSON.stringify(e[f].value)} (${e[f].confidence})`).join(", ")
    : "nothing read";
  const cands =
    r.match?.candidates.map((c) => `${c.statementLineId}:${c.score}`).join(" ") || "none";
  // Which stage stopped the receipt (v2-day4-pre-stress did not show it, and S03 was misread).
  const errors = result.log
    .filter((row) => row.receiptId === r.id && row.errorCode)
    .map((row) => `${row.stage} ${row.errorCode}`);
  return [
    `read: ${read}${e ? `; isReceipt ${e.isReceipt}` : ""}`,
    `status ${r.state.status}${r.match?.statementLineId ? ` → ${r.match.statementLineId}` : ""}; exceptions [${r.state.exceptions.join(", ")}]; queue group ${groupOf(result, r.id)}`,
    `candidates: ${cands}`,
    `run log errors: ${errors.join(", ") || "none"}`,
  ];
}

/** Statement lines with a negative amount (refunds, credits) offered as a receipt's candidate. */
function creditCandidates(result: MonthResult): string[] {
  const credit = new Set(result.statementLines.filter((l) => l.amountAud < 0).map((l) => l.id));
  return result.receipts.flatMap((r) =>
    (r.match?.candidates ?? [])
      .filter((c) => credit.has(c.statementLineId))
      .map((c) => `${r.id} lists credit ${c.statementLineId} (score ${c.score})`),
  );
}

function verdict(failures: string[], correct: boolean): Pick<CaseResult, "pass" | "outcome"> {
  if (failures.length > 0) return { pass: false, outcome: "failure" };
  return { pass: true, outcome: correct ? "correct" : "safe" };
}

// ---------- the stress month (S01 to S08) ----------

const only = values.ids ? new Set(values.ids.split(",").map((s) => s.trim())) : null;
const allIntake = Intake.parse(JSON.parse(readFileSync(join(STRESS, "receipts.json"), "utf8")));
const allTruth = StressTruth.parse(JSON.parse(readFileSync(join(STRESS, "truth.json"), "utf8")));
const stressIntake = {
  ...allIntake,
  receipts: allIntake.receipts.filter((r) => !only || only.has(r.id)),
};
const stressTruth = {
  ...allTruth,
  receipts: allTruth.receipts.filter((r) => !only || only.has(r.id)),
};
const stressLines = readStatement(
  readFileSync(join(STRESS, "statement-format-a.csv"), "utf8"),
).lines;

const db = openDb(":memory:");
const fxSource: FxClient =
  mode === "live" ? new FrankfurterFxClient(env.FX_BASE_URL, true) : new ReplayFxClient();
console.log(
  `Running ${stressIntake.receipts.length} stress receipts in ${mode} mode as "${label}"...`,
);
const stress = await runMonth(
  {
    monthKey: stressIntake.monthKey,
    receipts: stressIntake.receipts,
    statementLines: stressLines,
    readFile: async (r) => readFileSync(join(STRESS, r.file.path)),
  },
  {
    model: createModelClient(env),
    fx: new CachedFxClient(fxSource, db),
    config,
    runId: `${label}-stress`,
  },
);

const byId = new Map(stress.receipts.map((r) => [r.id, r]));
const results: CaseResult[] = [];

for (const c of stressTruth.receipts) {
  const r = byId.get(c.id);
  if (!r) throw new Error(`${c.id} missing from the run`);
  const failures: string[] = [];
  const observed = describe(stress, r);
  const t = c.truth;
  const wrong = confidentlyWrong(r, t);
  let correct = false;

  switch (c.id) {
    case "S01": {
      const extracted = stress.log.some(
        (row) => row.receiptId === "S01" && row.stage === "extract",
      );
      if (!r.state.exceptions.includes("UNREADABLE")) failures.push("not flagged UNREADABLE");
      if (extracted) failures.push("sent to the model despite failing the gate");
      if (r.state.status === "matched") failures.push("matched to a line");
      if (!r.state.excludedFromTotals) failures.push("counted in totals");
      correct = failures.length === 0;
      observed.push(`note: ${r.notes.join(" ") || "none"}`);
      break;
    }
    case "S02":
    case "S05": {
      if (wrong.length > 0 && bulkApprovable(stress, r)) {
        failures.push(`confidently wrong ${wrong.join(", ")} and bulk-approvable`);
      } else if (wrong.length > 0) {
        failures.push(
          `confidently wrong ${wrong.join(", ")} (caught only because another check failed)`,
        );
      }
      correct =
        r.extraction !== null &&
        Math.abs(Number(r.extraction.total.value) - t.total) <= 0.01 &&
        r.extraction.date.value === t.date &&
        r.extraction.currency.value === t.currency;
      break;
    }
    case "S03": {
      if (!r.state.exceptions.includes("NOT_A_RECEIPT")) failures.push("not flagged NOT_A_RECEIPT");
      if (r.state.status === "matched") failures.push(`took line ${r.match?.statementLineId}`);
      if (!stress.noReceiptLines.some((l) => l.id === "L05"))
        failures.push("L05 not listed as a line with no receipt");
      correct = failures.length === 0;
      break;
    }
    case "S04": {
      const flagged =
        r.lowConfidenceFields.includes("currency") || r.extraction?.currency.value == null;
      if (!flagged) {
        failures.push(
          `currency ${JSON.stringify(r.extraction?.currency.value)} accepted at confidence ${r.extraction?.currency.confidence} with no printed evidence (R-CUR-5)`,
        );
      }
      if (bulkApprovable(stress, r)) failures.push("bulk-approvable");
      break;
    }
    case "S06": {
      if (r.state.status === "matched")
        failures.push(`auto-paired with part payment ${r.match?.statementLineId}`);
      if (bulkApprovable(stress, r)) failures.push("bulk-approvable");
      for (const id of t.lineIds) {
        const takenBy = stress.receipts.find(
          (o) => o.id !== "S06" && o.match?.statementLineId === id,
        );
        if (takenBy) failures.push(`${id} taken by ${takenBy.id}`);
      }
      break;
    }
    case "S07": {
      if (r.state.status !== "matched" || r.match?.statementLineId !== "L08") {
        failures.push("not matched to the purchase L08");
      }
      failures.push(...creditCandidates(stress).filter((s) => s.includes("L09")));
      correct = failures.length === 0;
      break;
    }
    case "S08": {
      failures.push(...creditCandidates(stress).filter((s) => s.includes("L10")));
      if (r.state.status === "matched") failures.push(`matched to ${r.match?.statementLineId}`);
      if (!r.state.exceptions.includes("NO_PAYMENT_FOUND"))
        failures.push("not flagged NO_PAYMENT_FOUND");
      correct = failures.length === 0;
      break;
    }
  }
  results.push({
    id: c.id,
    title: c.title,
    stress: c.stress,
    expect: c.expect,
    ...verdict(failures, correct),
    observed,
    failures,
  });
}

// ---------- October data: S09 statement, S10 FX outage ----------

const truth = GroundTruth.parse(
  JSON.parse(readFileSync(join(DATASET, "ground-truth.json"), "utf8")),
);
const expectedLines: StatementLine[] = truth.statementLines.map(
  ({ receiptId: _r, note: _n, ...l }) => l,
);

{
  const failures: string[] = [];
  const observed: string[] = [];
  try {
    const read = readStatement(
      readFileSync(join(STRESS, "statement-extra-header-iso-dates.csv"), "utf8"),
    );
    observed.push(`read ${read.lines.length} lines as ${read.format}`);
    if (JSON.stringify(read.lines) !== JSON.stringify(expectedLines)) {
      failures.push("lines differ from the plain format-A statement");
    }
  } catch (error) {
    if (!(error instanceof StatementFormatError)) throw error;
    observed.push(`rejected: "${error.problems.join(" ")}"`);
    failures.push("a valid statement was rejected");
  }
  results.push({
    id: "S09",
    title: "Statement with an extra header row and ISO dates",
    stress: "a statement CSV with an extra header row and a different date format",
    expect: "The October statement (44 lines) read exactly as the plain format-A file reads it.",
    ...verdict(failures, failures.length === 0),
    observed,
    failures,
  });
}

class DownFx implements FxClient {
  async getRates(): Promise<FxRate[]> {
    throw new FxError("FX_API_ERROR", "simulated outage");
  }
}

const octIntake = Intake.parse(JSON.parse(readFileSync(join(DATASET, "receipts.json"), "utf8")));
const octLines = readStatement(readFileSync(join(DATASET, "statement-format-a.csv"), "utf8")).lines;
async function october(fx: FxClient, runId: string): Promise<MonthResult> {
  return runMonth(
    {
      monthKey: octIntake.monthKey,
      receipts: octIntake.receipts,
      statementLines: octLines,
      readFile: async (r) => readFileSync(join(DATASET, r.file.path)),
    },
    { model: createModelClient(replayEnv), fx, config, runId },
  );
}
const touches = (m: MonthResult) => m.receipts.filter((r) => !bulkApprovable(m, r)).length;

{
  const normal = await october(
    new CachedFxClient(new ReplayFxClient(), openDb(":memory:")),
    `${label}-fx-normal`,
  );
  const cold = await october(
    new CachedFxClient(new DownFx(), openDb(":memory:")),
    `${label}-fx-cold`,
  );
  const warmDb = openDb(":memory:");
  await october(new CachedFxClient(new ReplayFxClient(), warmDb), `${label}-fx-prime`);
  const warm = await october(new CachedFxClient(new DownFx(), warmDb), `${label}-fx-warm`);

  const failures: string[] = [];
  const foreign = cold.receipts.filter(
    (r) => r.extraction && r.extraction.currency.value !== "AUD",
  );
  for (const r of foreign) {
    const c = r.conversion;
    if (c?.status === "converted")
      failures.push(`${r.id} converted with no rate source (rate ${c.rate})`);
    const paidFromLine = r.state.paymentStatus === "paid" && r.state.ledgerAmountAud !== null;
    const excluded =
      r.state.exceptions.includes("FX_RATE_UNAVAILABLE") && r.state.excludedFromTotals;
    if (!paidFromLine && !excluded)
      failures.push(`${r.id} neither paid from its line nor excluded`);
  }
  if (!cold.log.some((row) => row.errorCode === "FX_NO_RATES"))
    failures.push("outage not in the run log");
  const warmSame =
    JSON.stringify(warm.totals) === JSON.stringify(normal.totals) &&
    touches(warm) === touches(normal);
  if (!warmSame) failures.push("a warm cache did not reproduce the normal month");

  const flaggedNeedlessly = cold.receipts.filter(
    (r) => r.state.exceptions.includes("FX_RATE_UNAVAILABLE") && r.state.paymentStatus === "paid",
  );
  results.push({
    id: "S10",
    title: "FX API unreachable",
    stress: "the FX API being unreachable (simulated)",
    expect:
      "No rate of 1, ever. With a cold cache: each foreign receipt is paid at the bank's AUD charge or flagged FX_RATE_UNAVAILABLE and left out of totals with the amount shown. With a warm cache: the same month as normal.",
    ...verdict(failures, flaggedNeedlessly.length === 0),
    observed: [
      `foreign receipts: ${foreign.length}; cold cache: ${cold.receipts.filter((r) => r.state.exceptions.includes("FX_RATE_UNAVAILABLE")).length} flagged FX_RATE_UNAVAILABLE, of which ${flaggedNeedlessly.length} already paid at the bank's AUD charge (${flaggedNeedlessly.map((r) => r.id).join(", ") || "none"})`,
      `ledger total: normal ${normal.totals.ledgerAud}, cold ${cold.totals.ledgerAud}, warm ${warm.totals.ledgerAud}; excluded (cold): ${JSON.stringify(cold.totals.excludedFx)}`,
      `human touches over 40 receipts: normal ${touches(normal)}, cold ${touches(cold)}, warm ${touches(warm)}`,
    ],
    failures,
  });
}

// ---------- write ----------

let commit = "unknown";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
} catch {
  // not a git checkout
}
const inputTokens = stress.log.reduce((s, r) => s + (r.inputTokens ?? 0), 0);
const outputTokens = stress.log.reduce((s, r) => s + (r.outputTokens ?? 0), 0);
const passed = results.filter((r) => r.pass).length;
const summary = {
  label,
  mode,
  ranAt: new Date().toISOString(),
  commit,
  model: env.MODEL_EXTRACT,
  reasoningEffort: env.MODEL_REASONING_EFFORT,
  passed,
  of: results.length,
  outcomes: {
    correct: results.filter((r) => r.outcome === "correct").length,
    safe: results.filter((r) => r.outcome === "safe").length,
    failure: results.filter((r) => r.outcome === "failure").length,
  },
  tokens: {
    input: inputTokens,
    output: outputTokens,
    measuredFrom: mode === "live" ? "this run" : "the recorded live run",
  },
  cases: results,
};

const report = [
  `# Stress run \`${label}\``,
  "",
  `Mode **${mode}**, model \`${env.MODEL_EXTRACT}\` (effort ${env.MODEL_REASONING_EFFORT}), commit \`${commit}\`, ${summary.ranAt}.`,
  "",
  "A case passes when the system fails *safely*: the right answer, or a person is asked. **correct** = right answer; **safe** = wrong or unsure, but routed to a person; **failure** = a silent wrong value, a wrong pairing, or a rejected valid input.",
  "",
  `**${passed}/${results.length} pass** (${summary.outcomes.correct} correct, ${summary.outcomes.safe} safe, ${summary.outcomes.failure} failure).`,
  "",
  "| ID | Stress case | Result | Outcome |",
  "|---|---|---|---|",
  ...results.map((r) => `| ${r.id} | ${r.title} | ${r.pass ? "PASS" : "FAIL"} | ${r.outcome} |`),
  "",
  ...results.flatMap((r) => [
    `## ${r.id}: ${r.title}`,
    "",
    `- 06 stress case: ${r.stress}`,
    `- Expected: ${r.expect}`,
    ...r.observed.map((o) => `- Observed: ${o}`),
    ...(r.failures.length
      ? r.failures.map((f) => `- **Failed:** ${f}`)
      : ["- Failed assertions: none"]),
    "",
  ]),
  `Tokens (stress receipts, ${summary.tokens.measuredFrom}): ${inputTokens} input, ${outputTokens} output.`,
  "",
].join("\n");

const out = join(ROOT, "eval-results", label);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(join(out, "report.md"), report);
console.log(
  `Stress cases: ${passed}/${results.length} pass (${summary.outcomes.correct} correct, ${summary.outcomes.safe} safe, ${summary.outcomes.failure} failure).`,
);
console.log(`Wrote eval-results/${label}/{summary.json, report.md}`);
