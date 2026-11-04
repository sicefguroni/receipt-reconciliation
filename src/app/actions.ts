"use server";

import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { z } from "zod";
import { FxError } from "@/adapters/fx/types";
import { RecordingMissingError } from "@/adapters/model/types";
import { StatementFormatError } from "@/adapters/statement/read-statement";
import { getEnv } from "@/config/env";
import { DEFAULT_ACTOR, isPerson } from "@/config/people";
import { isBulkApprovable } from "@/core/approvals";
import { inMatchWindow } from "@/core/matching";
import {
  CorrectableField,
  type DecisionChange,
  FileMime,
  MonthKey,
  PaymentSource,
  type ReceiptIntake,
} from "@/core/schemas";
import {
  decide,
  getMonth,
  logFailure,
  readStatementLogged,
  runAndStore,
  runSampleMonth,
} from "@/server/months";
import { tabOf } from "./tabs";

// Server actions. Every form posts here; errors go back to the page as plain sentences, never
// stacks. Each review action becomes one decision, checked against the month as it stands.

function friendly(error: unknown): string {
  if (error instanceof RecordingMissingError) {
    return "This app is in replay mode, which can only read receipts that were recorded in advance. Set MODE=live in .env (with an OpenAI key) to read new receipts.";
  }
  if (error instanceof StatementFormatError || error instanceof FxError) return error.message;
  return "Something went wrong while processing the month. Nothing was saved. Try again, and if it keeps happening, check the Runs page.";
}

const ACTOR_COOKIE = "actor";

export async function currentActor(): Promise<string> {
  const value = (await cookies()).get(ACTOR_COOKIE)?.value;
  return isPerson(value) ? value : DEFAULT_ACTOR;
}

export async function switchActor(form: FormData): Promise<void> {
  const id = String(form.get("actor") ?? "");
  if (isPerson(id)) (await cookies()).set(ACTOR_COOKIE, id, { sameSite: "lax", path: "/" });
  // Back to the same page; only a same-site path, never an outside address.
  const referer = (await headers()).get("referer");
  const path = referer ? new URL(referer).pathname : "/";
  redirect(path.startsWith("/") && !path.startsWith("//") ? path : "/");
}

// --- Starting a month -------------------------------------------------------------------

/** Back to a page with a plain-language message. Declared so TypeScript narrows on it. */
function back(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

/** The sample month's 40 submitted receipts, with the sample statement or an uploaded one. */
export async function startSampleMonth(form: FormData): Promise<void> {
  const statement = form.get("statement");
  let runId: string;
  try {
    const text =
      statement instanceof File && statement.size > 0 ? await statement.text() : undefined;
    runId = await runSampleMonth(text);
  } catch (error) {
    back("/", friendly(error));
  }
  redirect(`/review/${runId}`);
}

const UploadForm = z.object({
  monthKey: MonthKey,
  submitterId: z.string().trim().min(1, "Choose who submitted the receipts."),
  paymentSource: PaymentSource,
  businessPurpose: z.string().trim().max(500),
});

const MAX_BYTES = 15 * 1024 * 1024;

export async function uploadMonth(form: FormData): Promise<void> {
  const fields = UploadForm.safeParse({
    monthKey: form.get("monthKey"),
    submitterId: form.get("submitterId"),
    paymentSource: form.get("paymentSource"),
    businessPurpose: form.get("businessPurpose") ?? "",
  });
  const files = form.getAll("receipts").filter((f): f is File => f instanceof File && f.size > 0);
  const statement = form.get("statement");

  if (!fields.success) back("/upload", fields.error.issues[0]?.message ?? "Check the form fields.");
  if (files.length === 0) back("/upload", "Choose at least one receipt file.");
  if (files.length > 100) back("/upload", "Upload at most 100 receipts at a time.");
  if (!(statement instanceof File) || statement.size === 0)
    back("/upload", "Choose the statement CSV.");
  const f = fields.data;
  for (const file of files) {
    if (!FileMime.safeParse(file.type).success) {
      back(
        "/upload",
        `"${file.name}" is not a PDF, JPEG, or PNG. Upload receipts in one of those.`,
      );
    }
    if (file.size > MAX_BYTES) {
      back("/upload", `"${file.name}" is larger than 15 MB. Upload a smaller copy.`);
    }
  }

  const runId = randomUUID();
  let lines: Awaited<ReturnType<typeof readStatementLogged>>;
  try {
    lines = readStatementLogged(runId, await statement.text());
  } catch (error) {
    back("/upload", friendly(error));
  }
  if (!lines.lines.some((l) => inMatchWindow(l.date, f.monthKey))) {
    logFailure(runId, "statement", new Error("STATEMENT_WRONG_MONTH"));
    back(
      "/upload",
      `The statement has no transactions in ${f.monthKey} (or 5 days either side). Check the month, or the file.`,
    );
  }

  const store = getEnv().FILE_STORE_DIR;
  try {
    const intake: ReceiptIntake[] = [];
    for (const [i, file] of files.entries()) {
      const data = Buffer.from(await file.arrayBuffer());
      const mime = FileMime.parse(file.type);
      const uploadId = randomUUID();
      mkdirSync(join(store, uploadId), { recursive: true });
      // Keep the original name (it is part of the model request) but never trust it as a path.
      // Leading dots are dropped so a name like ".." cannot point outside the upload folder.
      const filename =
        file.name
          .replace(/[^\w.-]/g, "_")
          .replace(/^\.+/, "")
          .slice(0, 100) || "receipt";
      // Runtime upload paths, not build inputs: tell Turbopack not to trace them.
      writeFileSync(join(/*turbopackIgnore: true*/ store, uploadId, filename), data);
      const size =
        mime === "application/pdf"
          ? {}
          : await sharp(data)
              .metadata()
              .then((m) => ({ width: m.width, height: m.height }));
      intake.push({
        id: `U${i + 1}`,
        monthKey: f.monthKey,
        submitterId: f.submitterId,
        paymentSource: f.paymentSource,
        businessPurpose: f.businessPurpose || undefined,
        uploadOrder: i + 1,
        file: {
          path: `${uploadId}/${filename}`,
          mime,
          ...size,
          sha256: createHash("sha256").update(data).digest("hex"),
        },
      });
    }
    await runAndStore(
      {
        monthKey: f.monthKey,
        receipts: intake,
        statementLines: lines.lines,
        statementFormat: lines.format,
        fileRoot: store,
        readFile: async (r) => readFileSync(join(/*turbopackIgnore: true*/ store, r.file.path)),
      },
      runId,
    );
  } catch (error) {
    back("/upload", friendly(error));
  }
  redirect(`/review/${runId}`);
}

// --- Review actions ---------------------------------------------------------------------

const text = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
};

function reviewPath(runId: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params).toString();
  const anchor = params.open ? `#item-${params.open}` : "";
  return `/review/${encodeURIComponent(runId)}${query ? `?${query}` : ""}${anchor}`;
}

/**
 * One form, many actions: the button pressed names the action (`name="action"`), and the
 * form's fields carry what it needs. Builds the decision's change; the rules are checked in
 * `decide` (src/pipeline/decisions.ts), not here.
 */
export async function review(form: FormData): Promise<void> {
  const runId = text(form, "runId");
  const subjectId = text(form, "subjectId");
  const action = text(form, "action");
  const reason = text(form, "reason");
  const actor = await currentActor();
  // The tab the person was on, so an action that closes the item keeps them there.
  const before = getMonth(runId);
  const tab = (before && tabOf(before, subjectId)) || undefined;

  let changes: DecisionChange[] = [];
  let done = "";
  switch (action) {
    case "approve":
      // The match is filled in by the server from the item as it stands.
      changes = [{ action, after: { statementLineId: null, reimbursement: false } }];
      done = `${subjectId} approved.`;
      break;
    case "choose_match": {
      const choice = text(form, "line") || text(form, "otherLine");
      if (!choice) {
        redirect(reviewPath(runId, { error: "Choose a payment first.", open: subjectId }));
      }
      changes = [{ action, after: { statementLineId: choice === "reimburse" ? null : choice } }];
      done =
        choice === "reimburse"
          ? `${subjectId} set to reimburse.`
          : `${subjectId} matched to ${choice}.`;
      break;
    }
    case "split_payment": {
      const ids = form
        .getAll("splitLine")
        .filter((v): v is string => typeof v === "string" && v !== "");
      if (ids.length < 2) {
        redirect(
          reviewPath(runId, {
            error: "Tick at least two payments that together paid this receipt.",
            open: subjectId,
          }),
        );
      }
      changes = [{ action, after: { statementLineIds: ids } }];
      done = `${subjectId} matched to ${ids.join(" + ")}.`;
      break;
    }
    case "sign_off_difference":
      changes = [{ action, after: { statementLineId: text(form, "lineId") } }];
      done = `Difference on ${subjectId} signed off.`;
      break;
    case "confirm_duplicate":
      changes = [{ action: "resolve_duplicate", after: { duplicate: true } }];
      done = `${subjectId} confirmed as a duplicate.`;
      break;
    case "not_duplicate":
      changes = [{ action: "resolve_duplicate", after: { duplicate: false } }];
      done = `${subjectId} kept: not a duplicate.`;
      break;
    case "request_reupload":
      changes = [{ action, after: {} }];
      done = `${subjectId} removed from this month.`;
      break;
    case "link_receipt":
      changes = [{ action, after: { receiptId: text(form, "receiptId") } }];
      done = `${subjectId} linked to ${text(form, "receiptId")}.`;
      break;
    case "record_substitute":
      changes = [
        {
          action,
          after: {
            category: text(form, "category"),
            ...(form.get("overrideSuggestion") === "on" ? { overrideSuggestion: true } : {}),
          },
        },
      ];
      done = `Substitute recorded for ${subjectId}.`;
      break;
    case "mark_not_expense":
      changes = [{ action, after: {} }];
      done = `${subjectId} marked not an expense.`;
      break;
    case "correct": {
      // Only fields that changed, plus flagged fields the person has now looked at.
      const month = getMonth(runId);
      const r = month?.receipts.find((x) => x.id === subjectId);
      const confirm = new Set(text(form, "confirm").split(",").filter(Boolean));
      for (const field of CorrectableField.options) {
        if (!form.has(field)) continue;
        const value = text(form, field).trim();
        const current =
          field === "businessPurpose"
            ? r?.businessPurpose
            : field === "paymentSource"
              ? r?.paymentSource
              : field === "category"
                ? r?.category?.category
                : r?.extraction?.[field].value;
        const numeric = field === "total" || field === "tax";
        const unchanged =
          numeric && value !== "" && current != null
            ? Number(current) === Number(value.replace(/[$,\s]/g, ""))
            : String(current ?? "") === value;
        if (unchanged && !confirm.has(field)) continue;
        changes.push({
          action: "correct_field",
          after: {
            field,
            value: value === "" ? null : value,
            alwaysForVendor: field === "category" && form.get("alwaysForVendor") === "on",
          },
        });
      }
      if (changes.length === 0) {
        redirect(reviewPath(runId, { note: "Nothing changed.", open: subjectId }));
      }
      done = `${subjectId} updated.`;
      break;
    }
    default:
      redirect(reviewPath(runId, { error: "That action was not understood. Reload the page." }));
  }

  for (const change of changes) {
    const result = await decide(runId, { subjectId, change, reason }, actor);
    if (!result.ok) redirect(reviewPath(runId, { error: result.message, open: subjectId }));
  }
  // After a step that usually leads to another (sign off, approve), keep the item open where
  // it now sits, so the person does not have to find it again in its new group.
  const nextStepFollows = [
    "choose_match",
    "split_payment",
    "correct",
    "not_duplicate",
    "link_receipt",
  ].includes(action);
  const target = action === "link_receipt" ? text(form, "receiptId") : subjectId;
  const stillOpen = getMonth(runId)?.receipts.find((r) => r.id === target)?.outcome === "open";
  redirect(
    reviewPath(
      runId,
      nextStepFollows && stillOpen
        ? { note: done, open: target }
        : { note: done, ...(tab ? { tab } : {}) },
    ),
  );
}

/** R-APR-3: approves every listed item that is still bulk-approvable for this person. */
export async function bulkApprove(form: FormData): Promise<void> {
  const runId = text(form, "runId");
  const requested = new Set(text(form, "ids").split(",").filter(Boolean));
  const actor = await currentActor();
  // The page's list is a convenience; R-APR-3 is checked again on the month as it stands.
  const ids = (getMonth(runId)?.receipts ?? [])
    .filter((r) => requested.has(r.id) && r.outcome === "open")
    .filter((r) => isBulkApprovable({ status: r.state.status, exceptions: r.openExceptions }))
    .map((r) => r.id);
  let approved = 0;
  for (const subjectId of ids) {
    const result = await decide(
      runId,
      {
        subjectId,
        change: { action: "approve", after: { statementLineId: null, reimbursement: false } },
      },
      actor,
    );
    if (result.ok) approved += 1;
  }
  redirect(
    reviewPath(runId, { note: `${approved} of ${requested.size} matches approved.`, tab: "5" }),
  );
}
