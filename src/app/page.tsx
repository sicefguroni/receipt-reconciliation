import Link from "next/link";
import { getEnv } from "@/config/env";
import { listRuns } from "@/server/months";
import { loadSampleMonth } from "./actions";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const env = getEnv();
  const runs = listRuns();
  return (
    <main>
      <h1>Receipt reconciliation</h1>
      <p>
        Mode: <strong>{env.MODE}</strong>
        {env.MODE === "replay" ? " (recorded model answers; no API key needed)" : ""}
      </p>
      <form action={loadSampleMonth}>
        <button type="submit">Load the October sample month</button>
      </form>
      <p>
        or <Link href="/upload">upload a receipt and a statement</Link>.
      </p>
      <h2>Recent runs</h2>
      {runs.length === 0 ? (
        <p>No runs yet.</p>
      ) : (
        <ul>
          {runs.map((r) => (
            <li key={r.id}>
              <Link href={`/review/${r.id}`}>
                {r.monthKey}, {r.mode}, {new Date(r.finishedAt).toLocaleString("en-AU")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
