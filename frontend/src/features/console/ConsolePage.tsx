import { useEffect, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { selectActiveSheetDetail } from "@/app/state/selectors";
import type { GameClient } from "@/hooks/useGameClient";
import { PlayerCharacterSheet } from "@/features/sheets/PlayerCharacterSheet";
import { ExtensionPage } from "@/features/extension/ExtensionPage";
import { ConsoleSidebar } from "@/features/console/ConsoleSidebar";
import type { ConsoleView } from "@/features/console/consoleSidebarData";
import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";

export function ConsolePage({ client }: { client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const activeDetail = selectActiveSheetDetail(state);
  const [activeView, setActiveView] = useState<ConsoleView>("sheet_viewer");
  const [activeCharacterSection, setActiveCharacterSection] = useState<PlayerSheetTab>("dense");

  useEffect(() => {
    setActiveView("sheet_viewer");
    setActiveCharacterSection("dense");
  }, [activeDetail?.instance.id]);

  const showExtension = activeView === "extension";

  return (
    <div className="app-layout app-layout--player">
      <ConsoleSidebar
        role="player"
        client={client}
        activeView={activeView}
        activeCharacterSection={activeCharacterSection}
        onNavigate={setActiveView}
        onCharacterSectionChange={setActiveCharacterSection}
      />

      <main className="app-main-panel app-main-panel--player">
        <div className="player-workspace player-workspace--single">
          {showExtension ? (
            <section className="player-workspace__sheet player-workspace__sheet--extension">
              <ExtensionPage client={client} />
            </section>
          ) : (
            <section className="player-workspace__sheet">
              <PlayerCharacterSheet
                mode="player"
                client={client}
                activeSection={activeCharacterSection}
                onSectionChange={setActiveCharacterSection}
              />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
