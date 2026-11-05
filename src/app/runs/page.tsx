import { Activity, ArrowRight, CircleCheck, CircleX, ListTree } from "lucide-react";
import Link from "next/link";
import { runSummaries } from "@/server/months";
import { PageHeader, StatusBadge } from "../ui";

export const dynamic = "force-dynamic";

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
      <PageHeader
        eyebrow="System activity"
        title="Processing runs"
        icon={<Activity aria-hidden="true" size={24} />}
        description="Inspect every reconciliation pipeline, including retries, human fallbacks, model usage, and errors."
      />
      {runs.length === 0 ? <p className="empty-state">No processing runs yet.</p> : null}
      {runs.map((run) => {
        const stages = [...run.stages].sort(
          (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage),
        );
        return (
          <section key={run.runId} className="group run-card">
            <div className="group-head">
              <div>
                <p className="eyebrow">{run.mode ? `${run.mode} mode` : "Run"}</p>
                <h2>{run.monthKey ?? "Failed run"}</h2>
                <span className="count run-meta">{new Date(run.at).toLocaleString("en-AU")}</span>
              </div>
              <StatusBadge tone={run.failed ? "danger" : "success"}>
                {run.failed ? <CircleX size={14} /> : <CircleCheck size={14} />}
                {run.failed ? "Failed" : "Completed"}
              </StatusBadge>
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
                  {stages.map((stage) => (
                    <tr key={stage.stage}>
                      <td className="primary-cell">{STAGE_NAMES[stage.stage] ?? stage.stage}</td>
                      <td className="num">{stage.ok}</td>
                      <td className={`num${stage.retry ? " status-retry" : ""}`}>{stage.retry}</td>
                      <td className={`num${stage.fallback ? " status-fallback" : ""}`}>
                        {stage.fallback}
                      </td>
                      <td className={`num${stage.error ? " status-error" : ""}`}>{stage.error}</td>
                      <td className="num">{seconds(stage.totalMs)}</td>
                      <td className="num">
                        {stage.inputTokens || stage.outputTokens
                          ? `${stage.inputTokens.toLocaleString("en-AU")} / ${stage.outputTokens.toLocaleString("en-AU")}`
                          : "—"}
                      </td>
                      <td>
                        {Object.entries(stage.errorCodes)
                          .map(([code, count]) => `${code} ×${count}`)
                          .join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="run-actions">
              <Link href={`/runs/${run.runId}`} className="button icon-button">
                <ListTree aria-hidden="true" size={15} /> View run log
              </Link>
              {run.monthKey && !run.failed ? (
                <Link href={`/review/${run.runId}`} className="text-link">
                  Open review queue <ArrowRight aria-hidden="true" size={15} />
                </Link>
              ) : null}
            </div>
          </section>
        );
      })}
    </main>
  );
}
