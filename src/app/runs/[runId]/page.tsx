import Link from "next/link";
import { notFound } from "next/navigation";
import { runLogRows } from "@/server/months";

export const dynamic = "force-dynamic";

// Every run_log row for one run, as stored: ids, stages, durations, tokens, and codes.

export default async function RunLogPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const rows = runLogRows(runId);
  if (rows.length === 0) notFound();
  return (
    <main className="wide">
      <p>
        <Link href="/runs">Back to Runs</Link>
      </p>
      <h1>Run log</h1>
      <p className="muted">Run {runId}. One row per receipt per step.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Receipt</th>
              <th>Step</th>
              <th>Status</th>
              <th className="num">Duration</th>
              <th>Model</th>
              <th className="num">Tokens in / out</th>
              <th>Error code</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.at).toLocaleTimeString("en-AU")}</td>
                <td>{r.receiptId ?? "—"}</td>
                <td>{r.stage}</td>
                <td className={`status-${r.status}`}>{r.status}</td>
                <td className="num">{r.durationMs} ms</td>
                <td>{r.modelId ?? "—"}</td>
                <td className="num">
                  {r.inputTokens != null ? `${r.inputTokens} / ${r.outputTokens ?? 0}` : "—"}
                </td>
                <td>{r.errorCode ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
