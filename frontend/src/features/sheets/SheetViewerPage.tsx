import { SheetTabs } from "@/features/sheets/SheetTabs";
import { PlayerCharacterSheet } from "@/features/sheets/PlayerCharacterSheet";
import type { GameClient } from "@/hooks/useGameClient";

export function SheetViewerPage({ client }: { client: GameClient }): JSX.Element {
  return (
    <>
      <SheetTabs />
      <PlayerCharacterSheet mode="gm" panelTitle="Sheet Viewer" client={client} />
    </>
  );
}
