import type { KeyboardEvent, ReactElement } from "react";
import type { R6Tab } from "./types";

export interface SheetTabsProps {
  tabs: R6Tab[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
}

export function SheetTabs({ tabs, activeId, onChange, ariaLabel = "Character sheet sections" }: SheetTabsProps): ReactElement {
  const enabledTabs = tabs.filter((tab) => !tab.disabled);

  const move = (event: KeyboardEvent<HTMLButtonElement>, direction: 1 | -1): void => {
    const index = enabledTabs.findIndex((tab) => tab.id === activeId);
    if (index < 0) return;
    const next = enabledTabs[(index + direction + enabledTabs.length) % enabledTabs.length];
    if (!next) return;
    event.preventDefault();
    onChange(next.id);
    requestAnimationFrame(() => document.getElementById(`r6-tab-${next.id}`)?.focus());
  };

  return (
    <div className="r6-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          type="button"
          role="tab"
          id={`r6-tab-${tab.id}`}
          aria-selected={activeId === tab.id}
          aria-controls={`r6-panel-${tab.id}`}
          tabIndex={activeId === tab.id ? 0 : -1}
          disabled={tab.disabled}
          className={`r6-tab${activeId === tab.id ? " r6-tab--active" : ""}`}
          key={tab.id}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") move(event, 1);
            if (event.key === "ArrowLeft") move(event, -1);
            if (event.key === "Home" && enabledTabs[0]) {
              event.preventDefault();
              onChange(enabledTabs[0].id);
            }
            const lastTab = enabledTabs[enabledTabs.length - 1];
            if (event.key === "End" && lastTab) {
              event.preventDefault();
              onChange(lastTab.id);
            }
          }}
        >
          <span>{tab.label}</span>
          {tab.badge !== undefined ? <span className="r6-tab__badge">{tab.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
