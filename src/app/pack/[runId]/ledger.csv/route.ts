import { ledgerCsv } from "@/pipeline/pack";
import { getMonth } from "@/server/months";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const month = getMonth(runId);
  if (!month) return new Response("That month run was not found.", { status: 404 });
  return new Response(ledgerCsv(month), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ledger-${month.monthKey}.csv"`,
    },
  });
}
