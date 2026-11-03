"use server";

import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { z } from "zod";
import { FxError } from "@/adapters/fx/types";
import { RecordingMissingError } from "@/adapters/model/types";
import { parseFormatA, StatementFormatError } from "@/adapters/statement/format-a";
import { getEnv } from "@/config/env";
import { FileMime, MonthKey, PaymentSource, type ReceiptIntake } from "@/core/schemas";
import { runAndStore, runSampleMonth } from "@/server/months";

// Server actions for the v0 pages. Errors go back to the page as plain sentences, never stacks.

function friendly(error: unknown): string {
  if (error instanceof RecordingMissingError) {
    return "This app is in replay mode, which can only read receipts that were recorded in advance. Set MODE=live in .env (with an OpenAI key) to read new receipts.";
  }
  if (error instanceof StatementFormatError || error instanceof FxError) return error.message;
  return "Something went wrong while processing the month. Nothing was saved. Try again, and if it keeps happening, check the Runs log.";
}

export async function loadSampleMonth(): Promise<void> {
  let runId: string;
  try {
    runId = await runSampleMonth();
  } catch (error) {
    redirect(`/upload?error=${encodeURIComponent(friendly(error))}`);
  }
  redirect(`/review/${runId}`);
}

const UploadForm = z.object({
  monthKey: MonthKey,
  submitterId: z.string().trim().min(1, "Enter who submitted the receipt."),
  paymentSource: PaymentSource,
  businessPurpose: z.string().trim().max(500),
});

const MAX_BYTES = 15 * 1024 * 1024;

/** Back to the upload page with a plain-language message. Declared so TypeScript narrows on it. */
function back(message: string): never {
  redirect(`/upload?error=${encodeURIComponent(message)}`);
}

export async function uploadReceipt(form: FormData): Promise<void> {
  const fields = UploadForm.safeParse({
    monthKey: form.get("monthKey"),
    submitterId: form.get("submitterId"),
    paymentSource: form.get("paymentSource"),
    businessPurpose: form.get("businessPurpose") ?? "",
  });
  const file = form.get("receipt");
  const statement = form.get("statement");

  if (!fields.success) back(fields.error.issues[0]?.message ?? "Check the form fields.");
  if (!(file instanceof File) || file.size === 0) back("Choose a receipt file to upload.");
  if (!(statement instanceof File) || statement.size === 0) back("Choose the statement CSV.");
  const f = fields.data;
  const mime = FileMime.safeParse(file.type);
  if (!mime.success) back("The receipt must be a PDF, JPEG, or PNG.");
  if (file.size > MAX_BYTES) back("The receipt is larger than 15 MB. Upload a smaller copy.");

  let runId: string;
  try {
    const data = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(data).digest("hex");
    const uploadId = randomUUID();
    const dir = join(getEnv().FILE_STORE_DIR, uploadId);
    mkdirSync(dir, { recursive: true });
    // Keep the original name (it is part of the model request) but never trust it as a path.
    // Leading dots are dropped so a name like ".." cannot point outside the upload folder.
    const filename =
      file.name
        .replace(/[^\w.-]/g, "_")
        .replace(/^\.+/, "")
        .slice(0, 100) || "receipt";
    // Runtime upload paths, not build inputs: tell Turbopack not to trace them.
    const path = join(/*turbopackIgnore: true*/ dir, filename);
    writeFileSync(path, data);

    const size =
      mime.data === "application/pdf"
        ? {}
        : await sharp(data)
            .metadata()
            .then((m) => ({ width: m.width, height: m.height }));
    const intake: ReceiptIntake = {
      id: "U1",
      monthKey: f.monthKey,
      submitterId: f.submitterId,
      paymentSource: f.paymentSource,
      businessPurpose: f.businessPurpose || undefined,
      uploadOrder: 1,
      file: { path: filename, mime: mime.data, ...size, sha256 },
    };
    runId = await runAndStore({
      monthKey: f.monthKey,
      receipts: [intake],
      statementLines: parseFormatA(await statement.text()),
      readFile: async () => readFileSync(/*turbopackIgnore: true*/ path),
    });
  } catch (error) {
    back(friendly(error));
  }
  redirect(`/review/${runId}`);
}
