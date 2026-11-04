import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { pickSections, renderMarkdown } from "./markdown";

const README = readFileSync(join(import.meta.dirname, "../../../README.md"), "utf8");
const html = (md: string) =>
  renderToStaticMarkup(createElement(Fragment, null, ...renderMarkdown(md)));

describe("in-app guide from the README (Day 4, C1)", () => {
  const guide = pickSections(README, ["Close a month", "What each flag means"]);

  it("takes the user sections and leaves out setup", () => {
    expect(guide).toMatch(/^## Close a month/);
    expect(guide).toContain("## What each flag means");
    expect(guide).not.toContain("## Set it up");
  });

  it("renders the README's own lists, nesting, emphasis, and flag table", () => {
    const out = html(guide);
    expect(out).toContain("<h2>Close a month</h2>");
    // Step 2's five groups are a list inside the step, not loose text.
    expect(out).toMatch(
      /<li><strong>Work down the review queue\.<\/strong>[\s\S]*?<ol><li><em>Blocking intake problems<\/em>/,
    );
    const flagRows = README.slice(README.indexOf("## What each flag means"))
      .split("\n## ")[0]
      ?.split("\n")
      .filter((l) => l.startsWith("| ") && !l.startsWith("| Flag")).length;
    expect((out.match(/<tr>/g) ?? []).length - 1).toBe(flagRows);
    expect(out).not.toMatch(/\*\*|\| ---/); // no raw markdown left on the page
  });

  it("builds elements, so text that looks like HTML is shown, not run", () => {
    expect(html("A <script>alert(1)</script> note")).toContain("&lt;script&gt;");
  });
});
