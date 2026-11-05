import {
  ArrowRight,
  CalendarCheck2,
  CircleCheckBig,
  Clock3,
  FileSpreadsheet,
  Play,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { getEnv } from "@/config/env";
import { getMonth, listRuns } from "@/server/months";
import { startSampleMonth } from "./actions";
import { money } from "./labels";
import { SubmitButton } from "./submit-button";
import { PageHeader, StatusBadge } from "./ui";

export const dynamic = "force-dynamic";

function monthName(key: string): string {
  return new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const env = getEnv();
  const runs = listRuns().map((run) => ({ ...run, month: getMonth(run.id) }));
  const ready = runs.filter((run) => run.month?.closed).length;
  const active = runs.filter((run) => run.month && !run.month.closed).length;
  const latest = runs[0]?.month;

  return (
    <main className="wide dashboard">
      <PageHeader
        eyebrow="Month-end workspace"
        title="Close a month"
        icon={<CalendarCheck2 aria-hidden="true" size={24} />}
        description={
          <>
            Match receipts to statement lines, resolve exceptions, and export a clean ledger.
            <span className="mode-line">
              <StatusBadge tone={env.MODE === "replay" ? "info" : "success"}>
                {env.MODE === "replay" ? "Replay mode" : "Live mode"}
              </StatusBadge>
              {env.MODE === "replay"
                ? "Recorded answers · no API key required"
                : "Receipts are read with the configured model"}
            </span>
          </>
        }
        actions={
          <Link href="/upload" className="button primary icon-button">
            <ReceiptText aria-hidden="true" size={17} /> New upload
          </Link>
        }
      />

      <dl className="overview-stats">
        <div>
          <span className="stat-icon info">
            <Clock3 aria-hidden="true" size={18} />
          </span>
          <dt>In review</dt>
          <dd>{active}</dd>
        </div>
        <div>
          <span className="stat-icon success">
            <CircleCheckBig aria-hidden="true" size={18} />
          </span>
          <dt>Ready to close</dt>
          <dd>{ready}</dd>
        </div>
        <div>
          <span className="stat-icon neutral">
            <WalletCards aria-hidden="true" size={18} />
          </span>
          <dt>Latest ledger</dt>
          <dd>{money(latest?.totals.ledgerAud)}</dd>
        </div>
      </dl>

      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}

      <section className="feature-card">
        <div className="feature-copy">
          <span className="feature-icon">
            <FileSpreadsheet aria-hidden="true" size={25} />
          </span>
          <StatusBadge tone="info">Sample workspace</StatusBadge>
          <h2>October 2026 sample month</h2>
          <p>
            Reconcile 40 submitted receipts against the sample bank statement, then work through the
            exception queue.
          </p>
          <Link href="/guide" className="text-link">
            See how the workflow works <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </div>
        <form action={startSampleMonth} className="feature-action">
          <label className="file-field compact">
            <span>Use your own statement</span>
            <small>CSV · optional</small>
            <input type="file" name="statement" accept=".csv,text/csv" />
          </label>
          <SubmitButton
            type="submit"
            className="primary icon-button"
            pendingText="Matching the receipts…"
          >
            <Play aria-hidden="true" size={16} fill="currentColor" /> Match sample month
          </SubmitButton>
        </form>
      </section>

      <div className="section-heading">
        <div>
          <p className="eyebrow">Recent activity</p>
          <h2>Months</h2>
        </div>
        <Link href="/upload" className="text-link">
          Upload a new month <ArrowRight aria-hidden="true" size={15} />
        </Link>
      </div>

      {runs.length === 0 ? (
        <p className="empty-state">No months yet. Start with the sample workspace above.</p>
      ) : (
        <div className="table-card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Started</th>
                <th className="num">Items done</th>
                <th className="num">Ledger</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const month = run.month;
                const total = month ? month.receipts.length + month.noReceipt.length : 0;
                return (
                  <tr key={run.id}>
                    <td className="primary-cell">
                      {month ? (
                        <Link href={`/review/${run.id}`}>{monthName(run.monthKey)}</Link>
                      ) : (
                        monthName(run.monthKey)
                      )}
                    </td>
                    <td>{new Date(run.finishedAt).toLocaleString("en-AU")}</td>
                    <td className="num">{month ? `${month.done.length} of ${total}` : "—"}</td>
                    <td className="num">{money(month?.totals.ledgerAud)}</td>
                    <td>
                      {!month ? (
                        <StatusBadge tone="warning">Older version</StatusBadge>
                      ) : month.closed ? (
                        <StatusBadge tone="success">Ready to close</StatusBadge>
                      ) : (
                        <StatusBadge tone="info">In review</StatusBadge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
