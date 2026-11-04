import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pickSections, renderMarkdown } from "./markdown";

// Day 4 (C1): the guide inside the app. It is the README's user sections, read at request
// time, so the guide and the README are the same text.

export const dynamic = "force-dynamic";

const GUIDE_SECTIONS = [
  "Close a month",
  "What each flag means",
  "What the system decides",
  "What data leaves your computer",
  "When something goes wrong",
] as const;

export default function GuidePage() {
  const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
  return (
    <main className="guide">
      <h1>How to close a month</h1>
      <p className="muted">The same guide as the README that comes with this app.</p>
      {renderMarkdown(pickSections(readme, GUIDE_SECTIONS))}
    </main>
  );
}
