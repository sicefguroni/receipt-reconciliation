import { personLabel } from "@/config/people";
import { checkApproval } from "@/core/approvals";
import { inMatchWindow, isCredit, MIN_CANDIDATE_SCORE } from "@/core/matching";
import { MIN_REASON_CHARS } from "@/core/reasons";
import type { StatementLine } from "@/core/schemas";
import type { MonthResult, NoReceiptLine, ReceiptResult } from "@/pipeline/reconcile";
import { review } from "../../actions";
import { FIELD_LABELS, money } from "../../labels";

// The actions under one queue row. Plain forms posting to one server action; the rules are
// checked on the server (src/pipeline/decisions.ts), the page only offers what applies.

export function day(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function lineLabel(l: StatementLine): string {
  const foreign = l.originalAmount
    ? ` (${money(l.originalAmount.amount, l.originalAmount.currency)})`
    : "";
  return `${l.id}, ${day(l.date)}, ${l.description}, ${money(l.amountAud)}${foreign}`;
}

function Hidden({ runId, subjectId }: { runId: string; subjectId: string }) {
  return (
    <>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="subjectId" value={subjectId} />
    </>
  );
}

function ReasonField({ id, label, required }: { id: string; label: string; required?: boolean }) {
  return (
    <label className="field grow">
      {label}
      <input
        name="reason"
        id={id}
        minLength={required ? MIN_REASON_CHARS : undefined}
        required={required}
        maxLength={300}
        autoComplete="off"
      />
    </label>
  );
}

/**
 * Day 4 (C1): the receipt and the payment it is paired with, side by side, and what does not
 * fit (R-MAT-6). Shown before sign-off and approval, so a $14.70 coffee paired with a $75.20
 * petrol charge cannot pass as "Good" unnoticed.
 */
function PairingCheck({ r, month }: { r: ReceiptResult; month: MonthResult }) {
  const ids = r.match?.statementLineId
    ? [r.match.statementLineId, ...(r.match.extraLineIds ?? [])]
    : [];
  const lines = ids.flatMap((id) => month.statementLines.find((l) => l.id === id) ?? []);
  if (r.concerns.length === 0 || lines.length === 0) return null;
  const e = r.extraction;
  return (
    <div className="pairing" role="note" aria-label={`Check this pairing for ${r.id}`}>
      <p className="pairing-head">Check this pairing: {r.concerns.length} things do not fit.</p>
      <dl className="pairing-grid">
        <div>
          <dt>Receipt</dt>
          <dd>
            {e?.vendor.value ?? "Unknown vendor"},{" "}
            {money(e?.total.value, e?.currency.value ?? "AUD")}, {day(e?.date.value)},{" "}
            {r.paymentSourceLabel.toLowerCase()}
          </dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd>
            {lines
              .map((l) => `${l.id}, ${l.description}, ${money(l.amountAud)}, ${day(l.date)}`)
              .join(" + ")}
          </dd>
        </div>
      </dl>
      <ul>
        {r.concerns.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p className="hint">
        If this is right, say why in the reason. If not, choose another payment, reimburse, or
        remove the receipt.
      </p>
    </div>
  );
}

export function ReceiptPanel({
  r,
  month,
  actor,
  categories,
}: {
  r: ReceiptResult;
  month: MonthResult;
  actor: string;
  categories: readonly string[];
}) {
  const runId = month.runId;
  const e = r.extraction;
  const open = r.openExceptions;
  const allLines = new Map(month.statementLines.map((l) => [l.id, l]));
  const flagged = new Set(r.lowConfidenceFields);
  const needsDetails =
    open.includes("UNREADABLE") ||
    open.includes("LOW_CONFIDENCE_FIELD") ||
    open.includes("MISSING_PURPOSE") ||
    open.includes("UNKNOWN_CATEGORY");
  const approval = checkApproval(
    {
      submitterId: r.submitterId,
      status: r.state.status,
      exceptions: open,
      category: r.category ? r.category.category : undefined,
    },
    actor,
  );
  const canMatch = r.match !== null && !open.includes("DUPLICATE");
  const needsMatch =
    canMatch &&
    (open.includes("AMBIGUOUS_MATCH") ||
      open.includes("NO_PAYMENT_FOUND") ||
      open.includes("AMOUNT_DIFFERS_OVER_THRESHOLD"));
  // Ranked candidates first (R-MAT-2), then any other free line in the month.
  const candidates = (r.match?.candidates ?? []).filter(
    (c) => c.statementLineId !== r.match?.statementLineId,
  );
  const otherLines = month.freeLines.filter(
    (l) =>
      inMatchWindow(l.date, month.monthKey) && !candidates.some((c) => c.statementLineId === l.id),
  );
  const intake = open.includes("UNREADABLE") || open.includes("NOT_A_RECEIPT");
  // R-MAT-10: the lines this receipt is paid by now, then every other line it could take.
  const paidBy = r.match?.statementLineId
    ? [r.match.statementLineId, ...(r.match.extraLineIds ?? [])]
    : [];
  const splitLines = [
    ...paidBy.flatMap((id) => allLines.get(id) ?? []),
    ...candidates.flatMap((c) => {
      const l = allLines.get(c.statementLineId);
      return l && month.freeLines.some((f) => f.id === l.id) ? [l] : [];
    }),
    ...otherLines,
  ].filter((l, i, all) => all.findIndex((x) => x.id === l.id) === i);

  if (r.outcome !== "open") {
    return (
      <div className="panel">
        <Facts r={r} runId={runId} />
        {r.signOff ? (
          <p>
            Difference signed off by {personLabel(r.signOff.by)}: “{r.signOff.reason}”
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="panel">
      <Facts r={r} runId={runId} />

      {open.includes("DUPLICATE") ? (
        <form action={review} className="act">
          <Hidden runId={runId} subjectId={r.id} />
          <h4>Duplicate?</h4>
          <p className="hint">
            The system never deletes a receipt. A confirmed duplicate stays on record and out of
            totals.
          </p>
          <div className="row">
            <button
              type="submit"
              name="action"
              value="confirm_duplicate"
              className="primary"
              formNoValidate
            >
              Confirm duplicate
            </button>
          </div>
          <div className="row">
            <ReasonField id={`dup-${r.id}`} label="Or, why it is not a duplicate" />
            <button type="submit" name="action" value="not_duplicate">
              Not a duplicate
            </button>
          </div>
        </form>
      ) : null}

      <PairingCheck r={r} month={month} />

      {open.includes("AMOUNT_DIFFERS_OVER_THRESHOLD") ? (
        <form action={review} className="act">
          <Hidden runId={runId} subjectId={r.id} />
          <input type="hidden" name="lineId" value={r.match?.statementLineId ?? ""} />
          <h4>Sign off the difference</h4>
          <div className="row">
            <ReasonField id={`sign-${r.id}`} label="Reason for the difference" required />
            <button type="submit" name="action" value="sign_off_difference" className="primary">
              Sign off difference
            </button>
          </div>
        </form>
      ) : null}

      {r.match !== null || needsDetails ? (
        <details className="sub" open={needsDetails}>
          <summary>{needsDetails ? "Details to check" : "Change details"}</summary>
          <form action={review} className="act">
            <Hidden runId={runId} subjectId={r.id} />
            <input type="hidden" name="confirm" value={[...flagged].join(",")} />
            <div className="grid">
              {(["vendor", "date", "total", "currency", "tax", "summary"] as const).map((f) => (
                <label key={f} className={`field${flagged.has(f) ? " flagged" : ""}`}>
                  {f === "tax"
                    ? "GST"
                    : (FIELD_LABELS[f] ?? f).replace(/^./, (c) => c.toUpperCase())}
                  {flagged.has(f) ? <span className="flag-note"> (check this)</span> : null}
                  <input
                    name={f}
                    type={f === "date" ? "date" : "text"}
                    inputMode={f === "total" || f === "tax" ? "decimal" : undefined}
                    defaultValue={e?.[f].value != null ? String(e[f].value) : ""}
                    required={["vendor", "date", "total", "currency"].includes(f)}
                  />
                </label>
              ))}
              <label className={`field wide${open.includes("MISSING_PURPOSE") ? " flagged" : ""}`}>
                Business purpose
                <input
                  name="businessPurpose"
                  defaultValue={r.businessPurpose ?? ""}
                  maxLength={500}
                />
              </label>
              <label className="field">
                Paid with
                <select name="paymentSource" defaultValue={r.paymentSource}>
                  <option value="company_card">Company card</option>
                  <option value="personal_card">Personal card</option>
                  <option value="bank">Bank account</option>
                  <option value="unknown">Not known yet</option>
                </select>
              </label>
              <label className={`field${open.includes("UNKNOWN_CATEGORY") ? " flagged" : ""}`}>
                Category
                <select name="category" defaultValue={r.category?.category ?? ""}>
                  <option value="" disabled>
                    Choose a category
                  </option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check wide">
                <input type="checkbox" name="alwaysForVendor" /> Always use this category for{" "}
                {e?.vendor.value ?? "this vendor"}
              </label>
            </div>
            {r.category && r.category.source !== "human" ? (
              <p className="hint">
                Category from {r.category.source === "rule" ? "the vendor rules" : "the model"}:{" "}
                {r.category.reason}
              </p>
            ) : null}
            <div className="row">
              <button
                type="submit"
                name="action"
                value="correct"
                className={needsDetails ? "primary" : ""}
              >
                Save details
              </button>
            </div>
          </form>
        </details>
      ) : null}

      {canMatch ? (
        <details className="sub" open={needsMatch}>
          <summary>{needsMatch ? "Choose the payment" : "Wrong payment? Choose another"}</summary>
          <form action={review} className="act">
            <Hidden runId={runId} subjectId={r.id} />
            <fieldset>
              <legend className="sr-only">Statement line for {r.id}</legend>
              {candidates.map((c) => {
                const l = allLines.get(c.statementLineId);
                return (
                  <label key={c.statementLineId} className="choice">
                    <input type="radio" name="line" value={c.statementLineId} />
                    <span>
                      <strong>{l ? lineLabel(l) : c.statementLineId}</strong>
                      <span className="hint">
                        {" "}
                        {c.reasons.join(", ")}.{c.score < MIN_CANDIDATE_SCORE ? " Weak match." : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
              <label className="choice">
                <input type="radio" name="line" value="reimburse" />
                <span>
                  <strong>Paid personally: reimburse {personLabel(r.submitterId)}</strong>
                  <span className="hint"> No statement line.</span>
                </span>
              </label>
              {otherLines.length > 0 ? (
                <label className="field">
                  Or another statement line
                  <select name="otherLine" defaultValue="">
                    <option value="">None</option>
                    {otherLines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {lineLabel(l)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </fieldset>
            <div className="row">
              <ReasonField
                id={`match-${r.id}`}
                label={
                  r.paymentSource === "personal_card"
                    ? "Reason (optional)"
                    : "Reason (needed to reimburse)"
                }
              />
              <button
                type="submit"
                name="action"
                value="choose_match"
                className={needsMatch ? "primary" : ""}
              >
                Use this payment
              </button>
            </div>
          </form>
          {splitLines.length >= 2 ? (
            // Rare, so closed unless the receipt is already split (R-MAT-10).
            <details className="sub" open={paidBy.length > 1}>
              <summary>Paid in more than one payment?</summary>
              <form action={review} className="act">
                <Hidden runId={runId} subjectId={r.id} />
                <p className="hint">
                  For a deposit and a balance, for example. Tick every payment for this receipt;
                  their total is compared with the receipt.
                </p>
                <fieldset>
                  <legend className="sr-only">Payments that together paid {r.id}</legend>
                  {splitLines.map((l) => (
                    <label key={l.id} className="choice">
                      <input
                        type="checkbox"
                        name="splitLine"
                        value={l.id}
                        defaultChecked={paidBy.includes(l.id)}
                      />
                      <span>
                        <strong>{lineLabel(l)}</strong>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <div className="row">
                  <button type="submit" name="action" value="split_payment">
                    Use these payments together
                  </button>
                </div>
              </form>
            </details>
          ) : null}
        </details>
      ) : null}

      <form action={review} className="act approve">
        <Hidden runId={runId} subjectId={r.id} />
        <div className="row">
          <button
            type="submit"
            name="action"
            value="approve"
            className="approve-button"
            disabled={!approval.allowed}
            aria-describedby={approval.allowed ? undefined : `why-${r.id}`}
            title={approval.allowed ? undefined : approval.reason}
          >
            Approve
          </button>
          {approval.allowed ? (
            <span className="hint">
              {r.state.reimbursement
                ? `Adds ${money(r.state.ledgerAmountAud)} to reimburse.`
                : `Adds ${money(r.state.ledgerAmountAud)} to the ledger.`}
            </span>
          ) : (
            <span id={`why-${r.id}`} className="why">
              {approval.reason}
            </span>
          )}
        </div>
      </form>

      {intake || open.includes("NO_PAYMENT_FOUND") ? (
        <form action={review} className="act quiet">
          <Hidden runId={runId} subjectId={r.id} />
          <div className="row">
            <ReasonField id={`rm-${r.id}`} label="Note for the submitter (optional)" />
            <button type="submit" name="action" value="request_reupload">
              Remove from this month
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Facts({ r, runId }: { r: ReceiptResult; runId: string }) {
  const e = r.extraction;
  const c = r.conversion;
  return (
    <dl className="facts">
      <div>
        <dt>Receipt</dt>
        <dd>
          <a href={`/files/${runId}/${r.id}`} target="_blank" rel="noreferrer">
            Open the receipt file
          </a>
        </dd>
      </div>
      <div>
        <dt>Submitted by</dt>
        <dd>{personLabel(r.submitterId)}</dd>
      </div>
      <div>
        <dt>Paid with</dt>
        <dd>{r.paymentSourceLabel}</dd>
      </div>
      <div>
        <dt>Purpose</dt>
        <dd>{r.businessPurpose ?? <span className="query">Missing</span>}</dd>
      </div>
      <div>
        <dt>Category</dt>
        <dd>{r.category?.category ?? <span className="query">None</span>}</dd>
      </div>
      {c?.status === "converted" ? (
        <div>
          <dt>Exchange rate</dt>
          <dd>
            {money(e?.total.value, e?.currency.value ?? "")} at {c.rate.toFixed(4)} ({c.source},{" "}
            {day(c.rateDate)}) = {money(c.amountAud)}
          </dd>
        </div>
      ) : null}
      {r.match?.statementLineId ? (
        <div>
          <dt>Payment</dt>
          <dd>
            {[r.match.statementLineId, ...(r.match.extraLineIds ?? [])].join(" + ")}:{" "}
            {r.match.candidates[0]?.reasons.join(", ")}
          </dd>
        </div>
      ) : null}
      {r.corrected.length > 0 ? (
        <div>
          <dt>Changed by a person</dt>
          <dd>{r.corrected.map((f) => FIELD_LABELS[f] ?? f).join(", ")}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function LinePanel({
  n,
  month,
  categories,
}: {
  n: NoReceiptLine;
  month: MonthResult;
  categories: readonly string[];
}) {
  const runId = month.runId;
  if (n.resolution) {
    return (
      <div className="panel">
        <p>
          {n.resolution.kind === "substitute" ? "Substitute recorded" : "Marked not an expense"} by{" "}
          {personLabel(n.resolution.stamp.by)}: “{n.resolution.stamp.reason}”
        </p>
      </div>
    );
  }
  // Receipts that could take this line: open, readable, and not yet paid by a statement line.
  // A refund or credit pays for nothing, so it offers no link (R-MAT-8).
  const credit = isCredit(n.line);
  const linkable = credit
    ? []
    : month.receipts
        .filter((r) => r.outcome === "open" && r.match !== null && r.match.statementLineId === null)
        .sort(
          (a, b) => Number(n.candidateFor.includes(b.id)) - Number(n.candidateFor.includes(a.id)),
        );
  return (
    <div className="panel">
      <p className="hint">
        {n.line.description}, {day(n.line.date)}, {money(n.line.amountAud)}
        {n.line.account === "bank" ? ", business bank account." : ", company card."}
      </p>
      {linkable.length > 0 ? (
        <form action={review} className="act">
          <Hidden runId={runId} subjectId={n.line.id} />
          <h4>Link a receipt</h4>
          <div className="row">
            <label className="field grow">
              Receipt
              <select name="receiptId" defaultValue={n.candidateFor[0] ?? ""} required>
                <option value="" disabled>
                  Choose a receipt
                </option>
                {linkable.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id}, {r.extraction?.vendor.value ?? "unknown vendor"},{" "}
                    {money(r.extraction?.total.value, r.extraction?.currency.value ?? "AUD")}
                    {n.candidateFor.includes(r.id) ? " (possible match)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              name="action"
              value="link_receipt"
              className={n.candidateFor.length > 0 ? "primary" : ""}
            >
              Link receipt
            </button>
          </div>
        </form>
      ) : null}
      <form action={review} className="act">
        <Hidden runId={runId} subjectId={n.line.id} />
        <h4>{credit ? "Refund or credit" : "No receipt"}</h4>
        <div className="row">
          <label className="field">
            {credit ? "Category it reduces" : "Category (for a substitute)"}
            <select name="category" defaultValue="">
              <option value="">Choose</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <ReasonField id={`line-${n.line.id}`} label="Reason" required />
        </div>
        <div className="row">
          <button type="submit" name="action" value="record_substitute">
            {credit ? "Record the credit" : "Record a substitute"}
          </button>
          <button type="submit" name="action" value="mark_not_expense">
            Not an expense
          </button>
        </div>
      </form>
    </div>
  );
}
