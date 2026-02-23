import type { Role } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { RollLog } from "@/features/rolls/RollLog";
import { RollPanel } from "@/features/rolls/RollPanel";
import { PlayerCharacterSheet } from "@/features/sheets/PlayerCharacterSheet";

export function ConsolePage({
  role,
  client,
  activeSheetId
}: {
  role: Role;
  client: GameClient;
  activeSheetId: string | null;
}): JSX.Element {
  return (
    <main className={`app-grid-player-shell ${role === "gm" ? "app-grid-player-shell--gm" : ""}`}>
      <section className="player-console-main">
        <PlayerCharacterSheet mode={role} panelTitle="Character Sheet" />
      </section>
      <section className="player-console-side">
        <RollPanel client={client} mode={role} />
        <RollLog sheetId={activeSheetId} />
      </section>
    </main>
  );
}
