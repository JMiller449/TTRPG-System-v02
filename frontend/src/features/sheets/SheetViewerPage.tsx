import { PlayerCharacterSheet } from "@/features/sheets/PlayerCharacterSheet";
import type { GameClient } from "@/hooks/useGameClient";
import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";

export function SheetViewerPage({
  client,
  activeSection,
  onSectionChange
}: {
  client: GameClient;
  activeSection: PlayerSheetTab;
  onSectionChange: (section: PlayerSheetTab) => void;
}): JSX.Element {
  return (
    <div className="main-panel-stack main-panel-stack--sheet-viewer">
      <PlayerCharacterSheet
        mode="gm"
        client={client}
        activeSection={activeSection}
        onSectionChange={onSectionChange}
      />
    </div>
  );
}
