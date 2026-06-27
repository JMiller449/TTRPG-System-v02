import { PlayerCharacterSheet } from "@/features/sheets/PlayerCharacterSheet";
import type { GameClient } from "@/hooks/useGameClient";

export function SheetViewerPage({ client }: { client: GameClient }): JSX.Element {
  return <PlayerCharacterSheet mode="gm" panelTitle="Sheet Viewer" client={client} />;
}
