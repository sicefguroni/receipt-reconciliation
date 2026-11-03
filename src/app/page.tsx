import Link from "next/link";
import { getEnv } from "@/config/env";
import { getMonth, listRuns } from "@/server/months";
import { startSampleMonth } from "./actions";
import { money } from "./labels";

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
  const runs = listRuns().map((r) => ({ ...r, month: getMonth(r.id) }));
  return (
    <main>
      <h1>Close a month</h1>
      <p className="muted">
        {env.MODE === "replay"
          ? "Replay mode: receipts are read from recorded answers, so no API key is needed. Only the sample receipts can be read."
          : "Live mode: receipts are sent to the OpenAI API to be read."}
      </p>

      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}

      <section className="notice">
        <h2>October 2026 sample month</h2>
        <p>
          Staff have submitted 40 receipts for October. Upload the bank statement export (CSV) to
          match them, or use the sample statement.
        </p>
        <form action={startSampleMonth} className="stack">
          <label>
            Statement export (CSV, optional)
            <input type="file" name="statement" accept=".csv,text/csv" />
          </label>
          <div>
            <button type="submit" className="primary">
              Match October's receipts
            </button>
          </div>
        </form>
      </section>

      <p>
        Have your own receipts? <Link href="/upload">Upload receipts and a statement</Link>.
      </p>

      <h2>Months in progress</h2>
      {runs.length === 0 ? (
        <p className="muted">No months yet. Start with October above.</p>
      ) : (
        <div className="table-wrap">
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
              {runs.map((r) => {
                const m = r.month;
                const total = m ? m.receipts.length + m.noReceipt.length : 0;
                return (
                  <tr key={r.id}>
                    <td>
                      {m ? (
                        <Link href={`/review/${r.id}`}>{monthName(r.monthKey)}</Link>
                      ) : (
                        monthName(r.monthKey)
                      )}
                    </td>
                    <td>{new Date(r.finishedAt).toLocaleString("en-AU")}</td>
                    <td className="num">{m ? `${m.done.length} of ${total}` : "—"}</td>
                    <td className="num">{money(m?.totals.ledgerAud)}</td>
                    <td>
                      {!m
                        ? "Made by an older version; start the month again"
                        : m.closed
                          ? "Ready to close"
                          : "In review"}
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
