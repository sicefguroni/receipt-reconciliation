import type { ReactNode } from "react";

// Day 4 (C1): "I didn't see any README". The in-app guide renders the README's own sections,
// so the two cannot drift. This is the subset the README uses (headings, paragraphs, nested
// lists, tables, bold, italic, code, links), built as React elements: no HTML is injected.

/** The README's "## " sections whose titles are listed, in README order. */
export function pickSections(markdown: string, titles: readonly string[]): string {
  const sections = markdown.split(/\r?\n(?=## )/);
  return sections.filter((s) => titles.some((t) => s.startsWith(`## ${t}`))).join("\n\n");
}

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;

export function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${i}-${part.slice(0, 12)}`;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={key}>{part.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link?.[1] && link[2]) {
      const external = /^https?:\/\//.test(link[2]);
      return (
        <a key={key} href={link[2]} {...(external ? { rel: "noreferrer", target: "_blank" } : {})}>
          {link[1]}
        </a>
      );
    }
    return part;
  });
}

interface ListItem {
  text: string;
  children: ListItem[];
  ordered: boolean;
}

function renderList(items: ListItem[], key: string): ReactNode {
  const ordered = items[0]?.ordered ?? false;
  const body = items.map((item, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: static README text, rendered once and never reordered.
    <li key={`${key}-${i}`}>
      {inline(item.text)}
      {item.children.length > 0 ? renderList(item.children, `${key}-${i}`) : null}
    </li>
  ));
  return ordered ? <ol key={key}>{body}</ol> : <ul key={key}>{body}</ul>;
}

const LIST_ITEM = /^(\s*)(\d+\.|-)\s+(.*)$/;
const cells = (row: string) =>
  row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function renderMarkdown(markdown: string): ReactNode[] {
  const out: ReactNode[] = [];
  const lines = markdown.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const key = `b${i}`;
    if (line.trim() === "") {
      i += 1;
    } else if (line.startsWith("## ")) {
      out.push(<h2 key={key}>{inline(line.slice(3))}</h2>);
      i += 1;
    } else if (line.trim().startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("|"))
        rows.push(lines[i++] ?? "");
      const [head, , ...body] = rows;
      out.push(
        <div key={key} className="table-wrap">
          <table>
            <thead>
              <tr>
                {cells(head ?? "").map((c, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static README text, rendered once and never reordered.
                  <th key={`${key}-h${j}`}>{inline(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, k) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static README text, rendered once and never reordered.
                <tr key={`${key}-r${k}`}>
                  {cells(r).map((c, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static README text, rendered once and never reordered.
                    <td key={`${key}-r${k}-${j}`}>{inline(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (LIST_ITEM.test(line)) {
      const top: ListItem[] = [];
      while (i < lines.length && LIST_ITEM.test(lines[i] ?? "")) {
        const [, indent = "", marker = "", text = ""] = LIST_ITEM.exec(lines[i] ?? "") ?? [];
        const item = { text, children: [], ordered: marker !== "-" };
        const parent = top[top.length - 1];
        if (indent.length >= 2 && parent) parent.children.push(item);
        else top.push(item);
        i += 1;
      }
      out.push(renderList(top, key));
    } else {
      const para: string[] = [];
      while (i < lines.length) {
        const l = lines[i] ?? "";
        if (l.trim() === "" || l.startsWith("## ") || l.trim().startsWith("|") || LIST_ITEM.test(l))
          break;
        para.push(l.trim());
        i += 1;
      }
      out.push(<p key={key}>{inline(para.join(" "))}</p>);
    }
  }
  return out;
}
