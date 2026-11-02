import { getEnv } from "@/config/env";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const env = getEnv();
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "3rem auto" }}>
      <h1>Receipt reconciliation</h1>
      <p>Setup is working. Upload, review queue, and month-end pack arrive on Days 2 and 3.</p>
      <p>
        Mode: <strong>{env.MODE}</strong>
      </p>
    </main>
  );
}
