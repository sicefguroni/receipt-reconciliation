import { isValidSignOffReason } from "@/core/amounts";
import { checkApproval } from "@/core/approvals";
import { isCredit } from "@/core/matching";
import {
  type CorrectableField,
  type Decision,
  DecisionChange,
  IsoDate,
  PaymentSource,
} from "@/core/schemas";
import type { PipelineConfig } from "./config";
import type { MonthResult, ReceiptResult } from "./reconcile";

// The decision boundary: a requested action is checked against the month as it stands now,
// then recorded as one immutable row with what it changed from (`before`). Messages are for
// the Accounting user: what is wrong and what to do.

export interface DecisionRequest {
  subjectId: string;
  change: unknown; // { action, after }, parsed here
  reason?: string | null;
}

/** A decision before it is stored. Kept as an intersection so `after` narrows on `action`. */
export type DecisionDraft = Pick<Decision, "subjectId" | "actorId" | "before"> & {
  reason: string | null;
} & DecisionChange;

export type DecisionCheck = { ok: true; decision: DecisionDraft } | { ok: false; message: string };

const fail = (message: string): DecisionCheck => ({ ok: false, message });

const OUTCOME_TEXT: Record<Exclude<ReceiptResult["outcome"], "open">, string> = {
  approved: "already approved",
  duplicate_confirmed: "confirmed as a duplicate",
  removed: "removed from this month",
};

/** A correction's value, trimmed and checked; `null` clears an optional field. */
function normaliseField(
  field: CorrectableField,
  raw: string | null,
  config: PipelineConfig,
): { value: string | null } | { error: string } {
  const text = raw?.trim() ?? "";
  switch (field) {
    case "vendor":
      return text.length >= 1 && text.length <= 200
        ? { value: text }
        : { error: "Enter the vendor name (up to 200 characters)." };
    case "date": {
      const ok = IsoDate.safeParse(text).success && !Number.isNaN(Date.parse(`${text}T00:00:00Z`));
      return ok
        ? { value: text }
        : { error: "Enter the date as YYYY-MM-DD, for example 2026-10-02." };
    }
    case "total":
    case "tax": {
      if (field === "tax" && text === "") return { value: null };
      const n = Number(text.replace(/[$,\s]/g, ""));
      return Number.isFinite(n) && n >= 0 && n < 10_000_000
        ? { value: n.toFixed(2) }
        : { error: `Enter the ${field} as a number, for example 18.50.` };
    }
    case "currency":
      return /^[A-Za-z]{3}$/.test(text)
        ? { value: text.toUpperCase() }
        : { error: "Enter a 3-letter currency code, for example AUD or USD." };
    case "summary":
      return text.length <= 200
        ? { value: text || null }
        : { error: "Keep the items under 200 characters." };
    case "businessPurpose":
      return text.length <= 500
        ? { value: text }
        : { error: "Keep the purpose under 500 characters." };
    case "paymentSource":
      return PaymentSource.safeParse(text).success
        ? { value: text }
        : { error: "Choose how it was paid." };
    case "category":
      return config.categories.categories.includes(text)
        ? { value: text }
        : { error: "Choose a category from the list." };
  }
}

function currentValue(r: ReceiptResult, field: CorrectableField): unknown {
  switch (field) {
    case "businessPurpose":
      return r.businessPurpose;
    case "paymentSource":
      return r.paymentSource;
    case "category":
      return r.category?.category ?? null;
    default:
      return r.extraction?.[field].value ?? null;
  }
}

/** R-MAT-8, for the person: why a refund cannot be chosen, and what to do instead. */
const CREDIT_NOT_PAYMENT = (lineId: string) =>
  `Statement line ${lineId} is a refund or credit, so it cannot be a receipt's payment. ` +
  "Record it against a category, or mark it not an expense.";

/** Is `lineId` free for this receipt: not written off, not a credit, not held by an approved receipt? */
function lineAvailable(month: MonthResult, lineId: string, receiptId: string): string | null {
  const listed = month.noReceipt.find((n) => n.line.id === lineId);
  if (listed?.resolution) return `Statement line ${lineId} was already resolved without a receipt.`;
  const holder = month.receipts.find((r) => r.match?.statementLineId === lineId);
  if (!listed && !holder) return `Statement line ${lineId} is not in this month's statement.`;
  if (listed && isCredit(listed.line)) return CREDIT_NOT_PAYMENT(lineId);
  if (holder && holder.id !== receiptId && holder.outcome !== "open") {
    return `Statement line ${lineId} belongs to receipt ${holder.id}, which is ${OUTCOME_TEXT[holder.outcome]}.`;
  }
  return null;
}

export function checkDecision(
  month: MonthResult,
  request: DecisionRequest,
  actorId: string,
  config: PipelineConfig,
): DecisionCheck {
  const parsed = DecisionChange.safeParse(request.change);
  if (!parsed.success)
    return fail("That action was not understood. Reload the page and try again.");
  const change = parsed.data;
  const reason = request.reason?.trim() || null;
  const record = (after: DecisionChange, before: unknown): DecisionCheck => ({
    ok: true,
    decision: { subjectId: request.subjectId, actorId, reason, before, ...after },
  });
  const needReason = (what: string) =>
    reason && reason.length >= 3 ? null : `Give a reason (at least 3 characters) ${what}.`;

  // R-MAT-7 actions act on a statement line with no receipt.
  if (
    change.action === "link_receipt" ||
    change.action === "record_substitute" ||
    change.action === "mark_not_expense"
  ) {
    const listed = month.noReceipt.find((n) => n.line.id === request.subjectId);
    if (!listed) return fail(`Statement line ${request.subjectId} is not waiting for a receipt.`);
    if (listed.resolution) return fail(`Statement line ${request.subjectId} is already resolved.`);
    if (change.action === "link_receipt") {
      if (isCredit(listed.line)) return fail(CREDIT_NOT_PAYMENT(listed.line.id));
      const r = month.receipts.find((x) => x.id === change.after.receiptId);
      if (!r) return fail(`There is no receipt ${change.after.receiptId} in this month.`);
      if (r.outcome !== "open") return fail(`Receipt ${r.id} is ${OUTCOME_TEXT[r.outcome]}.`);
      if (r.match === null)
        return fail(`Receipt ${r.id} must be readable before it can be linked.`);
      return record(change, { receiptLine: r.match.statementLineId, status: r.state.status });
    }
    if (change.action === "record_substitute") {
      const problem = needReason("for recording a substitute");
      if (problem) return fail(problem);
      if (!config.categories.categories.includes(change.after.category)) {
        return fail("Choose a category for the substitute.");
      }
    } else {
      const problem = needReason("for marking it not an expense");
      if (problem) return fail(problem);
    }
    return record(change, { resolution: null });
  }

  const r = month.receipts.find((x) => x.id === request.subjectId);
  if (!r) return fail(`There is no receipt ${request.subjectId} in this month.`);
  if (r.outcome !== "open") return fail(`Receipt ${r.id} is ${OUTCOME_TEXT[r.outcome]}.`);

  switch (change.action) {
    case "approve": {
      const check = checkApproval(
        {
          submitterId: r.submitterId,
          status: r.state.status,
          exceptions: r.openExceptions,
          category: r.category ? r.category.category : undefined,
        },
        actorId,
      );
      if (!check.allowed) return fail(check.reason);
      // Approved with the match it has now (the item is then locked).
      return record(
        {
          action: "approve",
          after: {
            statementLineId: r.match?.statementLineId ?? null,
            reimbursement: r.state.reimbursement,
          },
        },
        { status: r.state.status, ledgerAmountAud: r.state.ledgerAmountAud },
      );
    }
    case "correct_field": {
      const v = normaliseField(change.after.field, change.after.value, config);
      if ("error" in v) return fail(v.error);
      return record(
        { action: "correct_field", after: { ...change.after, value: v.value } },
        { value: currentValue(r, change.after.field) },
      );
    }
    case "choose_match": {
      if (r.match === null) {
        return fail(
          "Fix the receipt's details first: it has to be readable before it can be matched.",
        );
      }
      const lineId = change.after.statementLineId;
      if (lineId === null) {
        // "Paid personally, reimburse": the expected case for a personal card; otherwise a reason.
        const problem =
          r.paymentSource === "personal_card"
            ? null
            : needReason("for reimbursing with no statement line");
        if (problem) return fail(problem);
      } else {
        const problem = lineAvailable(month, lineId, r.id);
        if (problem) return fail(problem);
      }
      return record(change, { statementLineId: r.match.statementLineId, status: r.state.status });
    }
    case "sign_off_difference": {
      if (!r.openExceptions.includes("AMOUNT_DIFFERS_OVER_THRESHOLD")) {
        return fail("There is no amount difference to sign off on this receipt.");
      }
      if (!isValidSignOffReason(reason)) {
        return fail(
          'Give a reason for the difference (at least 3 characters), for example "tip added".',
        );
      }
      if (change.after.statementLineId !== r.match?.statementLineId) {
        return fail("The match changed since the page loaded. Reload and try again.");
      }
      return record(change, { status: r.state.status, ledgerAmountAud: r.state.ledgerAmountAud });
    }
    case "resolve_duplicate": {
      if (!r.openExceptions.includes("DUPLICATE"))
        return fail("This receipt is not flagged as a duplicate.");
      if (!change.after.duplicate) {
        const problem = needReason("for saying it is not a duplicate");
        if (problem) return fail(problem);
      }
      return record(change, { duplicateOf: r.duplicateOf });
    }
    case "request_reupload":
      return record(change, { status: r.state.status, exceptions: r.state.exceptions });
  }
}
