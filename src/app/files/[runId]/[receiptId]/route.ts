import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { getSnapshot } from "@/server/months";

export const dynamic = "force-dynamic";

// Serves a receipt's original file so the reviewer can check fields against it. The path comes
// from the stored run, never from the URL, and must resolve inside the run's file folder.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string; receiptId: string }> },
) {
  const { runId, receiptId } = await params;
  const snapshot = getSnapshot(runId);
  const receipt = snapshot?.receipts.find((r) => r.intake.id === receiptId);
  if (!snapshot?.fileRoot || !receipt) {
    return new Response("That receipt file was not found.", { status: 404 });
  }
  const root = resolve(/*turbopackIgnore: true*/ process.cwd(), snapshot.fileRoot);
  const path = resolve(/*turbopackIgnore: true*/ root, receipt.intake.file.path);
  if (!path.startsWith(root + sep)) {
    return new Response("That receipt file was not found.", { status: 404 });
  }
  try {
    return new Response(readFileSync(/*turbopackIgnore: true*/ path), {
      headers: {
        "Content-Type": receipt.intake.file.mime,
        "Content-Disposition": `inline; filename="${receiptId}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("The receipt file is no longer on this computer.", { status: 404 });
  }
}
