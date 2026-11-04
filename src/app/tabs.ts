import type { MonthResult } from "@/pipeline/reconcile";

// Day 4 (C1): "the UI feels cluttered vertically". The review queue shows one group at a time
// as tabs (at most six: the five R-QUE groups and Done), keeping R-QUE's order. Tabs are links
// (`?tab=`), so the page stays server-rendered and a tab can be bookmarked.

export const TABS = ["1", "2", "3", "4", "5", "done"] as const;
export type Tab = (typeof TABS)[number];

export const TAB_LABELS: Record<Tab, string> = {
  "1": "Blocking",
  "2": "Amount differences",
  "3": "Missing information",
  "4": "Match decisions",
  "5": "Ready to approve",
  done: "Done",
};

export function isTab(value: string | undefined): value is Tab {
  return (TABS as readonly string[]).includes(value ?? "");
}

/** The tab an item is on now, or null when it is not in this month. */
export function tabOf(month: MonthResult, itemId: string): Tab | null {
  const section = month.queue.find((s) => s.items.some((i) => i.id === itemId));
  if (section) return String(section.group) as Tab;
  return month.done.some((i) => i.id === itemId) ? "done" : null;
}

/**
 * Which tab to show: the open item's (so a person follows an item that moved group), else the
 * one asked for, else the first group with work in it, else Done.
 */
export function activeTab(month: MonthResult, open?: string, asked?: string): Tab {
  const ofOpen = open ? tabOf(month, open) : null;
  if (ofOpen) return ofOpen;
  if (isTab(asked)) return asked;
  const first = month.queue.find((s) => s.items.length > 0);
  return first ? (String(first.group) as Tab) : "done";
}
