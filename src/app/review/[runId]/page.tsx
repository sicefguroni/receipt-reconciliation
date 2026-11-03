import Link from "next/link";
import { notFound } from "next/navigation";
import { getRun } from "@/server/months";
import { FLAG_LABELS, money, STATUS_LABELS } from "../../labels";

export const dynamic = "force-dynamic";

// v0: the raw review queue, in R-QUE order with a total per group. Actions arrive on Day 3.
export default async function ReviewPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const run = getRun(runId);
  if (!run) notFound();
  const receipts = new Map(run.receipts.map((r) => [r.id, r]));
  const lines = new Map(run.noReceiptLines.map((l) => [l.id, l]));

  return (
    <main className="wide">
      <p>
        <Link href="/">← Home</Link> ·{" "}
        <a href={`/pack/${run.runId}/ledger.csv`}>Download ledger CSV</a>
      </p>
      <h1>Review queue: {run.monthKey}</h1>
      <p>
        {run.receipts.length} receipts, {run.noReceiptLines.length} statement lines with no receipt.
        Ledger total {money(run.totals.ledgerAud)}.
        {run.totals.excludedFx.map(
          (x) => ` Left out (no FX rate): ${money(x.amount, x.currency)}.`,
        )}
        {` Mode: ${run.mode}.`}
      </p>
      {run.queue.map((section) => (
        <section key={section.group}>
          <h2>
            {section.group}. {section.title} ({section.items.length}, {money(section.totalAud)})
          </h2>
          {section.items.length === 0 ? (
            <p className="muted">Nothing here.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Vendor / description</th>
                  <th>Date</th>
                  <th>Receipt</th>
                  <th>Ledger (AUD)</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>What to look at</th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item) => {
                  if (item.kind === "no_receipt_line") {
                    const l = lines.get(item.id);
                    return (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{l?.description}</td>
                        <td>{l?.date}</td>
                        <td>—</td>
                        <td>{money(l?.amountAud)}</td>
                        <td>—</td>
                        <td>No receipt</td>
                        <td>Link a receipt, record a substitute, or mark it not an expense.</td>
                      </tr>
                    );
                  }
                  const r = receipts.get(item.id);
                  if (!r) return null;
                  const e = r.extraction;
                  return (
                    <tr key={item.id}>
                      <td>{r.id}</td>
                      <td>{e?.vendor.value ?? "—"}</td>
                      <td>{e?.date.value ?? "—"}</td>
                      <td>{money(e?.total.value, e?.currency.value ?? "AUD")}</td>
                      <td>
                        {money(r.state.ledgerAmountAud)}
                        {r.difference ? (
                          <span className="badge">
                            {r.difference.amount > 0 ? "+" : "−"}
                            {money(Math.abs(r.difference.amount), r.difference.currency)} vs receipt
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {r.category?.category ?? "—"}
                        <span className="muted"> ({r.category?.source ?? "none"})</span>
                      </td>
                      <td>
                        {STATUS_LABELS[r.state.status]}
                        {r.match?.statementLineId ? ` → ${r.match.statementLineId}` : ""}
                      </td>
                      <td>
                        <ul>
                          {r.state.exceptions.map((code) => (
                            <li key={code}>{FLAG_LABELS[code]}</li>
                          ))}
                          {r.notes.map((n) => (
                            <li key={n}>{n}</li>
                          ))}
                          {r.lowConfidenceFields.length > 0 ? (
                            <li>Check: {r.lowConfidenceFields.join(", ")}</li>
                          ) : null}
                          {r.state.reimbursement ? (
                            <li>Reimburse the submitter (no statement line)</li>
                          ) : null}
                          {r.state.status !== "matched"
                            ? r.match?.candidates.map((c) => (
                                <li key={c.statementLineId}>
                                  Candidate {c.statementLineId} ({c.score}): {c.reasons.join(", ")}
                                </li>
                              ))
                            : r.match?.candidates
                                .filter((c) => c.statementLineId === r.match?.statementLineId)
                                .map((c) => (
                                  <li key={c.statementLineId}>{c.reasons.join(", ")}</li>
                                ))}
                        </ul>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </main>
  );
}
