import { PlayerCharacterSheet } from "@/features/sheets/PlayerCharacterSheet";
import { ActiveSheetSelector } from "@/features/sheets/components/ActiveSheetSelector";
import type { GameClient } from "@/hooks/useGameClient";

export function SheetViewerPage({ client }: { client: GameClient }): JSX.Element {
  return (
    <div className="main-panel-stack">
      <ActiveSheetSelector client={client} />
      <PlayerCharacterSheet mode="gm" panelTitle="Spawned Sheet" client={client} />
    </div>
  );
}
