import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";

const CHARACTER_SHEET_TABS: Array<{ id: PlayerSheetTab; label: string }> = [
  { id: "stats", label: "Stats" },
  { id: "actions", label: "Actions" },
  { id: "equipment", label: "Equipment" },
  { id: "proficiencies", label: "Proficiencies" },
  { id: "notes", label: "Notes" }
];

export function CharacterSheetTabs({
  activeTab,
  onChange
}: {
  activeTab: PlayerSheetTab;
  onChange: (tab: PlayerSheetTab) => void;
}): JSX.Element {
  const selectTab = (index: number, tablist: HTMLElement | null): void => {
    const tab = CHARACTER_SHEET_TABS[index];
    if (!tab) {
      return;
    }
    onChange(tab.id);
    const tabButtons = tablist?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabButtons?.[index]?.focus();
  };

  const selectRelativeTab = (offset: number, tablist: HTMLElement | null): void => {
    const activeIndex = CHARACTER_SHEET_TABS.findIndex((tab) => tab.id === activeTab);
    const nextIndex =
      (activeIndex + offset + CHARACTER_SHEET_TABS.length) % CHARACTER_SHEET_TABS.length;
    selectTab(nextIndex, tablist);
  };

  return (
    <nav
      className="character-sheet__tabs"
      aria-label="Character sheet sections"
      role="tablist"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          selectRelativeTab(1, event.currentTarget);
          return;
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          selectRelativeTab(-1, event.currentTarget);
          return;
        }
        if (event.key === "Home") {
          event.preventDefault();
          selectTab(0, event.currentTarget);
          return;
        }
        if (event.key === "End") {
          event.preventDefault();
          selectTab(CHARACTER_SHEET_TABS.length - 1, event.currentTarget);
        }
      }}
    >
      {CHARACTER_SHEET_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`character-sheet__tab ${isActive ? "character-sheet__tab--active" : ""}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
