import { useEffect, useRef, type KeyboardEvent, type ReactElement } from "react";
import type { SheetTabDefinition } from "./types";

export function AccessibleSheetTabs({
  tabs,
  activeTab,
  onChange,
  idPrefix = "character-sheet"
}: {
  tabs: readonly SheetTabDefinition[];
  activeTab: string;
  onChange: (tabId: string) => void;
  idPrefix?: string;
}): ReactElement {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    refs.current = refs.current.slice(0, tabs.length);
  }, [tabs.length]);

  const enabledIndexes = tabs
    .map((tab, index) => ({ tab, index }))
    .filter(({ tab }) => !tab.disabled)
    .map(({ index }) => index);

  const move = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number): void => {
    if (!enabledIndexes.length) return;
    const currentEnabled = Math.max(0, enabledIndexes.indexOf(currentIndex));
    let targetIndex: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      targetIndex = enabledIndexes[(currentEnabled + 1) % enabledIndexes.length];
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      targetIndex = enabledIndexes[(currentEnabled - 1 + enabledIndexes.length) % enabledIndexes.length];
    } else if (event.key === "Home") {
      targetIndex = enabledIndexes[0];
    } else if (event.key === "End") {
      targetIndex = enabledIndexes[enabledIndexes.length - 1];
    }

    if (targetIndex === null) return;
    event.preventDefault();
    const target = tabs[targetIndex];
    onChange(target.id);
    refs.current[targetIndex]?.focus();
  };

  return (
    <nav className="cs-tabs" aria-label="Character sheet sections">
      <div className="cs-tabs__scroll" role="tablist" aria-orientation="horizontal">
        {tabs.map((tab, index) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(node) => { refs.current[index] = node; }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              className={`cs-tab ${selected ? "cs-tab--active" : ""}`}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => move(event, index)}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined ? <span className="cs-tab__badge">{tab.badge}</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
