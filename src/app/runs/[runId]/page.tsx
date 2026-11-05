import { ArrowLeft, ListTree } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { runLogRows } from "@/server/months";
import { PageHeader } from "../../ui";

export const dynamic = "force-dynamic";

// Every run_log row for one run, as stored: ids, stages, durations, tokens, and codes.

export default async function RunLogPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const rows = runLogRows(runId);
  if (rows.length === 0) notFound();
  return (
    <main className="wide">
      <PageHeader
        eyebrow="Diagnostics"
        title="Run log"
        icon={<ListTree aria-hidden="true" size={24} />}
        description={
          <>
            Run <code>{runId}</code>. One row per receipt per processing step.
          </>
        }
        actions={
          <Link href="/runs" className="button icon-button">
            <ArrowLeft aria-hidden="true" size={16} /> All runs
          </Link>
        }
      />
      <div className="table-card table-wrap">
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
