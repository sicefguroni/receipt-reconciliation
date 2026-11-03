import { ledgerCsv } from "@/pipeline/pack";
import { getRun } from "@/server/months";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const run = getRun(runId);
  if (!run) return new Response("That month run was not found.", { status: 404 });
  return new Response(ledgerCsv(run), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ledger-${run.monthKey}.csv"`,
    },
  });
}
