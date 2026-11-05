import { ArrowLeft, Download, PackageCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { personLabel } from "@/config/people";
import { packSummary, type Total } from "@/pipeline/pack";
import { getMonth } from "@/server/months";
import { FLAG_LABELS, money } from "../../labels";
import { day } from "../../review/[runId]/panels";
import { PageHeader } from "../../ui";

export const dynamic = "force-dynamic";

// The readable month-end summary (03, v1 item 9): totals by category and payment source,
// what was left out and why, and how each statement line with no receipt was resolved.
// Day 4 (P1): the same light cards and tables as the review queue.

function Card({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>{title}</h2>
        {note ? <p className="hint">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function TotalsTable({ caption, rows, total }: { caption: string; rows: Total[]; total: number }) {
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th>{caption}</th>
            <th className="num">Entries</th>
            <th className="num">AUD</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className="num">{r.count}</td>
              <td className="num">{money(r.amountAud)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="num">{rows.reduce((n, r) => n + r.count, 0)}</td>
            <td className="num">{money(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default async function PackPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const month = getMonth(runId);
  if (!month) notFound();
  const s = packSummary(month);
  const name = new Date(`${month.monthKey}-01T00:00:00Z`).toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="wide pack">
      <PageHeader
        eyebrow="Export and close"
        title={`Month-end pack: ${name}`}
        icon={<PackageCheck aria-hidden="true" size={24} />}
        description="Review totals, exclusions, and statement exceptions before exporting the final ledger."
        actions={
          <Link href={`/review/${runId}`} className="button icon-button">
            <ArrowLeft aria-hidden="true" size={16} /> Review queue
          </Link>
        }
      />
      {month.closed ? (
        <p className="notice">Every item is resolved. The month is ready to close.</p>
      ) : (
        <p role="status" className="notice error">
          Not ready to close: {s.openCount} items still need a decision ({s.openFlags} open flags).
          The files below show the month as it stands now.
        </p>
      )}

      <dl className="stats">
        <div className="stat">
          <dt>Ledger total</dt>
          <dd>{money(s.ledgerAud)}</dd>
        </div>
        <div className="stat">
          <dt>Entries</dt>
          <dd>{s.entryCount}</dd>
        </div>
        <div className="stat">
          <dt>Flags resolved</dt>
          <dd>{s.resolvedFlags}</dd>
        </div>
        <div className="stat">
          <dt>Still open</dt>
          <dd className={s.openCount > 0 ? "query" : undefined}>{s.openCount}</dd>
        </div>
      </dl>

      <p className="row">
        <a className="button primary icon-button" href={`/pack/${runId}/ledger.csv`} download>
          <Download aria-hidden="true" size={16} /> Download ledger
        </a>
        <a className="button icon-button" href={`/pack/${runId}/exceptions.csv`} download>
          <Download aria-hidden="true" size={16} /> Exceptions log
        </a>
      </p>

      <div className="card-grid">
        <Card title="By category">
          <TotalsTable caption="Category" rows={s.byCategory} total={s.ledgerAud} />
        </Card>
        <Card title="By payment source">
          <TotalsTable caption="Payment source" rows={s.bySource} total={s.ledgerAud} />
        </Card>
      </div>

      <Card
        title="Left out of the totals"
        note={
          s.excludedFx.length > 0
            ? `No exchange rate, so not converted to AUD: ${s.excludedFx
                .map((x) => `${money(x.amount, x.currency)} (${x.count} receipts)`)
                .join("; ")}.`
            : "Every foreign receipt had an exchange rate."
        }
      >
        {s.excludedReceipts.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Vendor</th>
                  <th className="num">Receipt amount</th>
                  <th>Why it is not in the ledger</th>
                </tr>
              </thead>
              <tbody>
                {s.excludedReceipts.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.extraction?.vendor.value ?? "—"}</td>
                    <td className="num">
                      {money(r.extraction?.total.value, r.extraction?.currency.value ?? "AUD")}
                    </td>
                    <td>
                      {r.outcome === "duplicate_confirmed"
                        ? `Duplicate of ${r.duplicateOf}`
                        : r.outcome === "removed"
                          ? "Removed: re-upload requested"
                          : r.state.exceptions.map((c) => FLAG_LABELS[c]).join("; ") ||
                            "Not resolved yet"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Card
        title="Statement lines with no receipt"
        note={
          s.noReceipt.length === 0 ? "Every payment on the statement has a receipt." : undefined
        }
      >
        {s.noReceipt.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th className="num">AUD</th>
                  <th>Resolved as</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {s.noReceipt.map(({ line, resolution, suggestedCategory }) => (
                  <tr key={line.id}>
                    <td>{line.id}</td>
                    <td className="nowrap">{day(line.date)}</td>
                    <td>{line.description}</td>
                    <td className="num">{money(line.amountAud)}</td>
                    <td>
                      {resolution === null ? (
                        <span className="query">Not resolved</span>
                      ) : resolution.kind === "substitute" ? (
                        <>
                          Substitute ({resolution.category}), by {personLabel(resolution.stamp.by)}
                          {/* R-CAT-6: a category chosen over the suggestion stays visible. */}
                          {suggestedCategory &&
                          suggestedCategory.category !== resolution.category ? (
                            <span className="flag-note">
                              {" "}
                              (suggested {suggestedCategory.category})
                            </span>
                          ) : null}
                        </>
                      ) : (
                        `Not an expense, by ${personLabel(resolution.stamp.by)}`
                      )}
                    </td>
                    <td>{resolution?.stamp.reason ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </main>
  );
}
