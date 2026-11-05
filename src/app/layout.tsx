import { ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { currentActor } from "./actions";
import { ActorSwitcher } from "./actor-switcher";
import { AppNav } from "./app-nav";
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
            <span className="brand-mark">
              <ReceiptText aria-hidden="true" size={19} strokeWidth={2.2} />
            </span>
            <span>
              Receipt reconciliation
              <small>Finance workspace</small>
            </span>
          </Link>
          <AppNav />
          {/* Simulated sign-in (03 non-goal: real authentication). Shows R-APR-1 in action. */}
          <ActorSwitcher current={actor} />
        </header>
        <div id="content">{children}</div>
      </body>
    </html>
  );
}
