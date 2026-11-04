import Link from "next/link";
import { notFound } from "next/navigation";
import { personLabel } from "@/config/people";
import { checkApproval, isBulkApprovable } from "@/core/approvals";
import type { QueueItem } from "@/core/queue";
import { getMonth, pipelineConfig } from "@/server/months";
import { bulkApprove, currentActor } from "../../actions";
import { lineNextStep, money, nextStep } from "../../labels";
import { SubmitButton } from "../../submit-button";
import { activeTab, TABS, type Tab } from "../../tabs";
import { day, LinePanel, ReceiptPanel } from "./panels";
import { QueueTabs } from "./queue-tabs";

export const dynamic = "force-dynamic";

// The review queue (02 "Target workflow"; R-QUE): one ledger, worst problems first, a total on
// every list, and the actions for each row inside it.

const GROUP_HINTS: Record<number, string> = {
  1: "Files that cannot go further until someone looks at them.",
  2: "Charges that differ from the receipt by more than policy allows. A reason is needed.",
  3: "Details to add or check before approving.",
  4: "Payments to choose, people to reimburse, and payments with no receipt.",
  5: "Matched to a payment. Check and approve, one by one or all at once.",
};

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ note?: string; error?: string; open?: string; tab?: string }>;
}) {
  const { runId } = await params;
  const { note, error, open, tab: askedTab } = await searchParams;
  const month = getMonth(runId);
  if (!month) notFound();
  const tab = activeTab(month, open, askedTab);
  const countOf = (t: Tab) =>
    t === "done"
      ? month.done.length
      : (month.queue.find((s) => String(s.group) === t)?.items.length ?? 0);
  const actor = await currentActor();
  const categories = pipelineConfig().categories.categories;
  const receipts = new Map(month.receipts.map((r) => [r.id, r]));
  const lines = new Map(month.noReceipt.map((n) => [n.line.id, n]));

  const total = month.receipts.length + month.noReceipt.length;
  const doneCount = month.done.length;
  const ready = month.queue.find((s) => s.group === 5)?.items ?? [];
  const bulk = ready.flatMap((item) => {
    const r = item.kind === "receipt" ? receipts.get(item.id) : undefined;
    if (!r || !isBulkApprovable({ status: r.state.status, exceptions: r.openExceptions }))
      return [];
    return [r];
  });
  const bulkMine = bulk.filter((r) => r.submitterId === actor);
  const bulkOk = bulk.filter((r) => r.submitterId !== actor);
  const bulkTotal =
    bulkOk.reduce((s, r) => s + Math.round((r.state.ledgerAmountAud ?? 0) * 100), 0) / 100;

  const row = (item: QueueItem, isDone: boolean) => {
    if (item.kind === "no_receipt_line") {
      const n = lines.get(item.id);
      if (!n) return null;
      return (
        <details key={item.id} id={`item-${item.id}`} className="item" open={open === item.id}>
          <summary>
            <span className={`tick${isDone ? " done" : ""}`}>
              <span className="sr-only">{isDone ? "Done" : "To do"}</span>
            </span>
            <span className="id">{item.id}</span>
            <span className="who">{n.line.description}</span>
            <span className="when">{day(n.line.date)}</span>
            <span className="amt">{money(n.line.amountAud)}</span>
            <span className="todo">{lineNextStep(n)}</span>
          </summary>
          <LinePanel n={n} month={month} categories={categories} />
        </details>
      );
    }
    const r = receipts.get(item.id);
    if (!r) return null;
    const e = r.extraction;
    const foreign = e?.currency.value && e.currency.value !== "AUD";
    const approve = checkApproval(
      { submitterId: r.submitterId, status: r.state.status, exceptions: r.openExceptions },
      actor,
    );
    return (
      <details key={item.id} id={`item-${item.id}`} className="item" open={open === item.id}>
        <summary>
          <span className={`tick${isDone ? " done" : ""}`}>
            <span className="sr-only">{isDone ? "Done" : "To do"}</span>
          </span>
          <span className="id">{r.id}</span>
          <span className="who">
            {e?.vendor.value ?? <span className="query">Unreadable</span>}
            {!isDone && !approve.allowed && approve.code === "SELF_APPROVAL_BLOCKED" ? (
              <span className="tag">yours</span>
            ) : null}
          </span>
          <span className="when">{day(e?.date.value)}</span>
          <span className="amt">
            {money(item.amountAud)}
            {foreign ? (
              <span className="sub-amt">{money(e?.total.value, e?.currency.value ?? "")}</span>
            ) : null}
            {r.difference ? (
              <span className="badge">
                {r.difference.amount > 0 ? "+" : "−"}
                {money(Math.abs(r.difference.amount), r.difference.currency)} vs receipt
              </span>
            ) : null}
          </span>
          <span className="todo">{nextStep(r)}</span>
        </summary>
        <ReceiptPanel r={r} month={month} actor={actor} categories={categories} />
      </details>
    );
  };

  // The column headings sit inside each group's card, as the table's header row.
  const cols = (
    <div className="cols" aria-hidden="true">
      <span />
      <span>Item</span>
      <span>Vendor or payment</span>
      <span>Date</span>
      <span className="amt">AUD</span>
      <span>What to do</span>
    </div>
  );

  const doneTotal = month.done.reduce((s, i) => s + Math.round((i.amountAud ?? 0) * 100), 0) / 100;

  return (
    <main className="ledger">
      <header className="month-head">
        <div>
          <h1>
            Review{" "}
            {new Date(`${month.monthKey}-01T00:00:00Z`).toLocaleDateString("en-AU", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </h1>
          <p className="muted">
            {month.receipts.length} receipts and {month.statementLines.length} statement lines
            {month.statementFormat ? `, read as ${month.statementFormat}` : ""}. Acting as{" "}
            {personLabel(actor)}.{" "}
            {month.mode === "replay" ? "Replay mode (recorded model answers)." : "Live mode."}
          </p>
        </div>
        <nav className="pack-links" aria-label="Month-end pack">
          <Link
            href={`/pack/${month.runId}`}
            className={month.closed ? "button primary" : "button"}
          >
            Month-end pack
          </Link>
        </nav>
      </header>

      <section className="progress" aria-label="Progress">
        <div
          className="bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={doneCount}
        >
          <span style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} />
        </div>
        <p>
          <strong>
            {doneCount} of {total}
          </strong>{" "}
          items done.{" "}
          {month.closed
            ? "Every item is resolved: the month is ready to close."
            : `${total - doneCount} to go.`}{" "}
          Ledger {money(month.totals.ledgerAud)}, of which {money(month.totals.approvedAud)}{" "}
          approved.
          {month.totals.excludedFx.map(
            (x) => ` Left out of totals (no exchange rate): ${money(x.amount, x.currency)}.`,
          )}
        </p>
      </section>

      {error ? (
        <p role="alert" className="notice error">
          {error}
        </p>
      ) : note ? (
        <p role="status" className="notice">
          {note}
        </p>
      ) : null}

      <QueueTabs
        runId={month.runId}
        tabs={TABS.map((id) => ({ id, count: countOf(id) }))}
        initial={tab}
        panels={{
          ...Object.fromEntries(
            month.queue.map((section) => [
              String(section.group),
              <section
                key={section.group}
                className={`group g${section.group}`}
                aria-labelledby={`g${section.group}`}
              >
                <div className="group-head">
                  <h2 id={`g${section.group}`}>
                    {section.title}{" "}
                    <span className="count">
                      {section.items.length} {section.items.length === 1 ? "item" : "items"}
                    </span>
                  </h2>
                  <span className="amt">{money(section.totalAud)}</span>
                </div>
                <p className="group-hint">
                  {section.items.length === 0 ? "Nothing here." : GROUP_HINTS[section.group]}
                </p>
                {section.group === 5 && bulkOk.length > 1 ? (
                  <form action={bulkApprove} className="bulk">
                    <input type="hidden" name="runId" value={month.runId} />
                    <input type="hidden" name="ids" value={bulkOk.map((r) => r.id).join(",")} />
                    <SubmitButton type="submit" className="primary" pendingText="Approving…">
                      Approve all {bulkOk.length} clean matches ({money(bulkTotal)})
                    </SubmitButton>
                    <span className="hint">
                      Only matched items with no flags.
                      {bulkMine.length > 0
                        ? ` ${bulkMine.length} you submitted are left for someone else to approve.`
                        : ""}
                    </span>
                  </form>
                ) : null}
                {section.items.length > 0 ? cols : null}
                {section.items.map((item) => row(item, false))}
              </section>,
            ]),
          ),
          done: (
            <section className="group done-group" aria-labelledby="g-done">
              <div className="group-head">
                <h2 id="g-done">
                  Done <span className="count">{doneCount} items</span>
                </h2>
                <span className="amt">{money(doneTotal)}</span>
              </div>
              <p className="group-hint">
                {doneCount === 0
                  ? "Approved and resolved items collect here."
                  : "Approved, confirmed duplicates, removed, and resolved payments."}
              </p>
              {month.done.length > 0 ? cols : null}
              {month.done.map((item) => row(item, true))}
            </section>
          ),
        }}
      />
    </main>
  );
}
