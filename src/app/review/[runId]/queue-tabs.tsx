"use client";

import { type MouseEvent, type ReactNode, useEffect, useState } from "react";
import { TAB_LABELS, TABS, type Tab } from "../../tabs";

// Day 4 (P1): "when i switch tabs, my inputs are erased", and "would stop me... if loading
// and rendering per tab is slow". Every group is rendered once, on the server; switching a tab
// only shows one and hides the others, so it is instant and anything typed stays. The tabs are
// still `?tab=` links: without JavaScript, or opened in a new browser tab, they load the page.

export interface TabInfo {
  id: Tab;
  count: number;
}

export function QueueTabs({
  runId,
  tabs,
  initial,
  panels,
}: {
  runId: string;
  tabs: TabInfo[];
  initial: Tab;
  panels: Partial<Record<Tab, ReactNode>>;
}) {
  const [active, setActive] = useState<Tab>(initial);
  // After an action the server picks the tab (the item's new group, or where the person was).
  useEffect(() => setActive(initial), [initial]);

  const select = (tab: Tab, event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return; // let the browser open it as a link
    }
    event.preventDefault();
    setActive(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    url.searchParams.delete("open");
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
  };

  return (
    <>
      <nav className="tabs" aria-label="Review groups">
        {tabs.map(({ id, count }) => (
          <a
            key={id}
            href={`/review/${encodeURIComponent(runId)}?tab=${id}`}
            className={`tab${id === active ? " active" : ""}${(id === "1" || id === "2") && count > 0 ? " urgent" : ""}`}
            aria-current={id === active ? "page" : undefined}
            onClick={(event) => select(id, event)}
          >
            {TAB_LABELS[id]} <span className="tab-count">{count}</span>
          </a>
        ))}
      </nav>
      {TABS.map((id) => (
        <div key={id} hidden={id !== active}>
          {panels[id]}
        </div>
      ))}
    </>
  );
}
