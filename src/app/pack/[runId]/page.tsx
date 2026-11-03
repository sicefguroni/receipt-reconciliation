import Link from "next/link";
import { notFound } from "next/navigation";
import { personLabel } from "@/config/people";
import { packSummary, type Total } from "@/pipeline/pack";
import { getMonth } from "@/server/months";
import { FLAG_LABELS, money } from "../../labels";
import { day } from "../../review/[runId]/panels";

export const dynamic = "force-dynamic";

// The readable month-end summary (03, v1 item 9): totals by category and payment source,
// what was left out and why, and how each statement line with no receipt was resolved.

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
    <main className="wide">
      <p>
        <Link href={`/review/${runId}`}>Back to the review queue</Link>
      </p>
      <h1>Month-end pack: {name}</h1>
      {month.closed ? (
        <p className="notice">
          Every item is resolved. Ledger total <strong>{money(s.ledgerAud)}</strong> from{" "}
          {s.entryCount} entries; {s.resolvedFlags} flags resolved.
        </p>
      ) : (
        <p role="status" className="notice error">
          Not ready to close: {s.openCount} items still need a decision ({s.openFlags} open flags).
          The files below show the month as it stands now.
        </p>
      )}

      <p className="row">
        <a className="button primary" href={`/pack/${runId}/ledger.csv`} download>
          Download ledger (CSV)
        </a>
        <a className="button" href={`/pack/${runId}/exceptions.csv`} download>
          Download exceptions log (CSV)
        </a>
      </p>

      <h2>By category</h2>
      <TotalsTable caption="Category" rows={s.byCategory} total={s.ledgerAud} />

      <h2 className="spaced">By payment source</h2>
      <TotalsTable caption="Payment source" rows={s.bySource} total={s.ledgerAud} />

      <h2 className="spaced">Left out of the totals</h2>
      {s.excludedFx.length > 0 ? (
        <p>
          No exchange rate, so not converted to AUD:{" "}
          {s.excludedFx
            .map((x) => `${money(x.amount, x.currency)} (${x.count} receipts)`)
            .join("; ")}
          .
        </p>
      ) : (
        <p className="muted">Every foreign receipt had an exchange rate.</p>
      )}
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

      <h2 className="spaced">Statement lines with no receipt</h2>
      {s.noReceipt.length === 0 ? (
        <p className="muted">Every payment on the statement has a receipt.</p>
      ) : (
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
              {s.noReceipt.map(({ line, resolution }) => (
                <tr key={line.id}>
                  <td>{line.id}</td>
                  <td>{day(line.date)}</td>
                  <td>{line.description}</td>
                  <td className="num">{money(line.amountAud)}</td>
                  <td>
                    {resolution === null ? (
                      <span className="query">Not resolved</span>
                    ) : resolution.kind === "substitute" ? (
                      `Substitute (${resolution.category}), by ${personLabel(resolution.stamp.by)}`
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
      )}
    </main>
  );
}
