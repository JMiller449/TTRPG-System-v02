import type { KeyboardEvent } from "react";
import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";

const SHEET_TABS: ReadonlyArray<{ id: PlayerSheetTab; label: string }> = [
  { id: "stats", label: "Stats" },
  { id: "actions", label: "Actions" },
  { id: "conditions", label: "Conditions" },
  { id: "equipment", label: "Equipment" },
  { id: "proficiencies", label: "Proficiencies" },
  { id: "kills", label: "Kills" },
  { id: "notes", label: "Notes" }
];

export function CharacterSheetTabs({
  activeTab,
  onChange
}: {
  activeTab: PlayerSheetTab;
  onChange: (tab: PlayerSheetTab) => void;
}): JSX.Element {
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number): void => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % SHEET_TABS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + SHEET_TABS.length) % SHEET_TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = SHEET_TABS.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextTab = SHEET_TABS[nextIndex];
    onChange(nextTab.id);
    const tabButtons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabButtons?.[nextIndex]?.focus();
  };

  return (
    <nav className="character-sheet__tabs" aria-label="Character sheet sections" role="tablist">
      {SHEET_TABS.map((tab, index) => {
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
