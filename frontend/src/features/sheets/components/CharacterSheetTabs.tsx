import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";

export function CharacterSheetTabs({
  activeTab,
  onChange
}: {
  activeTab: PlayerSheetTab;
  onChange: (tab: PlayerSheetTab) => void;
}): JSX.Element {
  return (
    <nav className="character-sheet__tabs" aria-label="Character sheet sections">
      <button
        className={`character-sheet__tab ${activeTab === "stats" ? "character-sheet__tab--active" : ""}`}
        onClick={() => onChange("stats")}
      >
        Stats
      </button>
      <button
        className={`character-sheet__tab ${activeTab === "equipment" ? "character-sheet__tab--active" : ""}`}
        onClick={() => onChange("equipment")}
      >
        Equipment
      </button>
      <button
        className={`character-sheet__tab ${activeTab === "notes" ? "character-sheet__tab--active" : ""}`}
        onClick={() => onChange("notes")}
      >
        Notes
      </button>
    </nav>
  );
}
