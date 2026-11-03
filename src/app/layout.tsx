import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PEOPLE } from "@/config/people";
import { currentActor, switchActor } from "./actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Receipt reconciliation",
  description: "Match a month of receipts to the card statement and review only the exceptions.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const actor = await currentActor();
  return (
    <html lang="en-AU">
      <body>
        <a href="#content" className="skip">
          Skip to content
        </a>
        <header className="site">
          <Link href="/" className="brand">
            Receipt reconciliation
          </Link>
          <nav aria-label="Main">
            <Link href="/">Months</Link>
            <Link href="/upload">Upload</Link>
            <Link href="/runs">Runs</Link>
          </nav>
          {/* Simulated sign-in (03 non-goal: real authentication). Shows R-APR-1 in action. */}
          <form action={switchActor} className="actor">
            <label>
              Acting as{" "}
              <select name="actor" defaultValue={actor}>
                {PEOPLE.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Switch</button>
          </form>
        </header>
        <div id="content">{children}</div>
      </body>
    </html>
  );
}
