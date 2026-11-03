import Link from "next/link";
import { runSummaries } from "@/server/months";

export const dynamic = "force-dynamic";

// The Runs page (Day 3 block 4): per run, per pipeline stage, how many items went through
// cleanly, were retried, fell back to a person, or failed, with time, tokens, and error codes.
// The log holds ids, numbers, and codes only, never receipt contents.

const STAGE_NAMES: Record<string, string> = {
  statement: "Read the statement",
  quality: "Quality check",
  extract: "Read the receipt (model)",
  categorise: "Category (model fallback)",
  fx: "Exchange rates",
  match: "Duplicates and matching",
  run: "Whole run",
};

const STAGE_ORDER = Object.keys(STAGE_NAMES);

function seconds(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export default function RunsPage() {
  const runs = runSummaries();
  return (
    <main className="wide">
      <h1>Runs</h1>
      <p className="muted">
        Each time a month is read, every step is logged here. “Fallback” means the step could not
        finish on its own and the item went to the review queue for a person. “Error” stopped the
        run; nothing was saved for it.
      </p>
      {runs.length === 0 ? <p>No runs yet.</p> : null}
      {runs.map((run) => {
        const stages = [...run.stages].sort(
          (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
        );
        return (
          <section key={run.runId} className="group">
            <div className="group-head">
              <h2>
                {run.monthKey ?? "Failed run"}{" "}
                <span className="count">
                  {new Date(run.at).toLocaleString("en-AU")}
                  {run.mode ? `, ${run.mode} mode` : ""}
                </span>
              </h2>
              <span className={run.failed ? "status-error" : "status-ok"}>
                {run.failed ? "Failed" : "Completed"}
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Step</th>
                    <th className="num">OK</th>
                    <th className="num">Retried</th>
                    <th className="num">Fallback</th>
                    <th className="num">Error</th>
                    <th className="num">Time</th>
                    <th className="num">Tokens in / out</th>
                    <th>Error codes</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map((s) => (
                    <tr key={s.stage}>
                      <td>{STAGE_NAMES[s.stage] ?? s.stage}</td>
                      <td className="num">{s.ok}</td>
                      <td className={`num${s.retry ? " status-retry" : ""}`}>{s.retry}</td>
                      <td className={`num${s.fallback ? " status-fallback" : ""}`}>{s.fallback}</td>
                      <td className={`num${s.error ? " status-error" : ""}`}>{s.error}</td>
                      <td className="num">{seconds(s.totalMs)}</td>
                      <td className="num">
                        {s.inputTokens || s.outputTokens
                          ? `${s.inputTokens.toLocaleString("en-AU")} / ${s.outputTokens.toLocaleString("en-AU")}`
                          : "—"}
                      </td>
                      <td>
                        {Object.entries(s.errorCodes)
                          .map(([code, n]) => `${code} ×${n}`)
                          .join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="row">
              <Link href={`/runs/${run.runId}`}>Every log row for this run</Link>
              {run.monthKey && !run.failed ? (
                <Link href={`/review/${run.runId}`}>Review queue</Link>
              ) : null}
            </p>
          </section>
        );
      })}
    </main>
  );
}
