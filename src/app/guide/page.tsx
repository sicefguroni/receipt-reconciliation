import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BookOpenText } from "lucide-react";
import { PageHeader } from "../ui";
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
      <PageHeader
        eyebrow="Accounting guide"
        title="How to close a month"
        icon={<BookOpenText aria-hidden="true" size={24} />}
        description="A practical reference for matching, resolving exceptions, approving, and exporting the final pack."
      />
      <article className="guide-card">
        {renderMarkdown(pickSections(readme, GUIDE_SECTIONS))}
      </article>
    </main>
  );
}
