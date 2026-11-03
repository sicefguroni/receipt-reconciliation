import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BaselineSubset, GroundTruth } from "./dataset/schema";
import { type AnswerRow, parseAnswerTable } from "./eval/answer-sheet";
import { type Ratio, type RunScore, scoreRun } from "./eval/score";

// Usage: pnpm score:baseline -- <label> <answer.md> [<answer.md> ...]
// Scores B0 or B1 answer tables against the 20-item baseline subset and writes
// eval-results/<label>/{summary.json, cases.csv, report.md}.

const ROOT = join(import.meta.dirname, "..");
const DATASET = join(ROOT, "fixtures", "dataset");

const pct = (r: Ratio) =>
  r.rate === null ? "n/a" : `${r.hit}/${r.of} (${(r.rate * 100).toFixed(0)}%)`;

function report(label: string, files: string[], runs: { score: RunScore; rows: AnswerRow[] }[]) {
  const header = `| Metric | ${runs.map((_, i) => `Run ${i + 1}`).join(" | ")} |`;
  const sep = `|---|${runs.map(() => "---").join("|")}|`;
  const row = (name: string, pick: (s: RunScore) => Ratio | undefined) =>
    `| ${name} | ${runs
      .map(({ score }) => {
        const r = pick(score);
        return r ? pct(r) : "n/a";
      })
      .join(" | ")} |`;
  const codes = [
    ...new Set(runs.flatMap(({ score }) => Object.keys(score.exceptionRecall))),
  ].sort();

  const lines = [
    `# ${label}: scores against ground truth`,
    "",
    `Answer files: ${files.map((f) => `\`${f}\``).join(", ")}. Baseline subset: 20 receipts.`,
    "",
    header,
    sep,
    row("Extraction: total", (s) => s.extraction.total),
    row("Extraction: currency", (s) => s.extraction.currency),
    row("Extraction: date", (s) => s.extraction.date),
    row("Extraction: vendor", (s) => s.extraction.vendor),
    row("Category accuracy", (s) => s.category),
    row("Match recall", (s) => s.matchRecall),
    row("Wrong-match rate", (s) => s.wrongMatchRate),
    row("Exception recall (amount, purpose, duplicate)", (s) => s.headlineExceptionRecall),
    ...codes.map((c) =>
      row(`Recall: ${c}`, (s) => s.exceptionRecall[c as keyof typeof s.exceptionRecall]),
    ),
    ...codes.map((c) =>
      row(`Precision: ${c}`, (s) => s.exceptionPrecision[c as keyof typeof s.exceptionPrecision]),
    ),
    "",
    "## Every miss, wrong match, and extra flag",
    "",
  ];
  runs.forEach(({ score, rows }, i) => {
    lines.push(`### Run ${i + 1}`, "");
    for (const c of score.cases) {
      const problems: string[] = [];
      if (c.lineOutcome === "wrong")
        problems.push(`wrong line ${c.predictedLine} (expected ${c.expectedLine ?? "none"})`);
      if (c.lineOutcome === "missed") problems.push(`no line given (expected ${c.expectedLine})`);
      if (c.missed.length) problems.push(`missed ${c.missed.join(", ")}`);
      if (c.extra.length) problems.push(`extra ${c.extra.join(", ")}`);
      for (const [ok, field] of [
        [c.totalOk, "total"],
        [c.currencyOk, "currency"],
        [c.dateOk, "date"],
        [c.vendorOk, "vendor"],
        [c.categoryOk, "category"],
      ] as const) {
        if (!ok) problems.push(`${field} wrong`);
      }
      if (problems.length) lines.push(`- ${c.receiptId}: ${problems.join("; ")}`);
    }
    lines.push("", "Flag coding (Flags column → codes):", "");
    for (const r of rows.filter((x) => x.cells.flags)) {
      lines.push(
        `- ${r.prediction.receiptId}: "${r.cells.flags}" → ${r.prediction.exceptions.join(", ") || "(none)"}`,
      );
    }
    lines.push("");
  });
  return lines.join("\n");
}

function main() {
  const [label, ...files] = process.argv.slice(2).filter((a) => a !== "--");
  if (!label || files.length === 0) {
    console.error("Usage: pnpm score:baseline -- <label> <answer.md> [<answer.md> ...]");
    process.exit(1);
  }
  const truth = GroundTruth.parse(
    JSON.parse(readFileSync(join(DATASET, "ground-truth.json"), "utf8")),
  );
  const subset = BaselineSubset.parse(
    JSON.parse(readFileSync(join(DATASET, "baseline-subset.json"), "utf8")),
  );
  const subsetTruth = truth.receipts.filter((r) => subset.receiptIds.includes(r.id));

  const runs = files.map((file) => {
    const rows = parseAnswerTable(readFileSync(file, "utf8"));
    const ids = rows.map((r) => r.prediction.receiptId);
    const missing = subset.receiptIds.filter((id) => !ids.includes(id));
    const extra = ids.filter((id) => !subset.receiptIds.includes(id));
    if (missing.length || extra.length) {
      console.warn(
        `${file}: missing ${missing.join(",") || "-"}; unexpected ${extra.join(",") || "-"}`,
      );
    }
    return {
      rows,
      score: scoreRun(
        subsetTruth,
        rows.map((r) => r.prediction),
      ),
    };
  });

  const out = join(ROOT, "eval-results", label);
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, "summary.json"),
    `${JSON.stringify(
      runs.map(({ score }, i) => ({ run: i + 1, file: files[i], ...score, cases: undefined })),
      null,
      2,
    )}\n`,
  );
  const csvRows = runs.flatMap(({ score }, i) =>
    score.cases.map((c) =>
      [
        i + 1,
        c.receiptId,
        c.totalOk,
        c.currencyOk,
        c.dateOk,
        c.vendorOk,
        c.categoryOk,
        c.expectedLine ?? "",
        c.predictedLine ?? "",
        c.lineOutcome,
        c.planted.join(" "),
        c.fired.join(" "),
        c.missed.join(" "),
        c.extra.join(" "),
      ].join(","),
    ),
  );
  writeFileSync(
    join(out, "cases.csv"),
    `run,receipt,total_ok,currency_ok,date_ok,vendor_ok,category_ok,expected_line,predicted_line,line_outcome,planted,fired,missed,extra\n${csvRows.join("\n")}\n`,
  );
  const md = report(label, files, runs);
  writeFileSync(join(out, "report.md"), `${md}\n`);
  console.log(md);
}

main();
