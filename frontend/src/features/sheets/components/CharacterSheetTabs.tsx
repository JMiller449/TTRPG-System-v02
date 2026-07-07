import type { KeyboardEvent } from "react";
import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";

const PLAYER_SHEET_TABS: ReadonlyArray<{ id: PlayerSheetTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "actions", label: "Actions" },
  { id: "inventory", label: "Inventory" },
  { id: "resistances", label: "Resistances" },
  { id: "details", label: "Details" },
  { id: "notes", label: "Notes" }
];

const GM_SHEET_TABS: ReadonlyArray<{ id: PlayerSheetTab; label: string }> = [
  ...PLAYER_SHEET_TABS,
  { id: "action_history", label: "Action History" },
  { id: "formula_stats", label: "Formula Stats" }
];

export function CharacterSheetTabs({
  activeTab,
  onChange,
  mode = "player"
}: {
  activeTab: PlayerSheetTab;
  onChange: (tab: PlayerSheetTab) => void;
  mode?: "player" | "gm";
}): JSX.Element {
  const tabs = mode === "gm" ? GM_SHEET_TABS : PLAYER_SHEET_TABS;
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number): void => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    onChange(nextTab.id);
    const tabButtons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabButtons?.[nextIndex]?.focus();
  };

  return (
    <nav className="character-sheet__tabs" aria-label="Character sheet sections" role="tablist">
      {tabs.map((tab, index) => {
        const selected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`sheet-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`sheet-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={`character-sheet__tab ${selected ? "character-sheet__tab--active" : ""}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
