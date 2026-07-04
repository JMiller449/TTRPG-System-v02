import { useEffect, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { selectActiveSheetDetail } from "@/app/state/selectors";
import type { Role } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { RollLog } from "@/features/rolls/RollLog";
import { RollPanel } from "@/features/rolls/RollPanel";
import { PlayerCharacterSheet } from "@/features/sheets/PlayerCharacterSheet";
import { ActiveSheetSelector } from "@/features/sheets/components/ActiveSheetSelector";
import { CharacterSheetTabs } from "@/features/sheets/components/CharacterSheetTabs";
import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";

export function ConsolePage({ role, client }: { role: Role; client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const activeDetail = selectActiveSheetDetail(state);
  const [activeTab, setActiveTab] = useState<PlayerSheetTab>("overview");

  useEffect(() => {
    setActiveTab("overview");
  }, [activeDetail?.instance.id]);

  if (role === "player") {
    return (
      <div className="app-layout app-layout--player">
        <aside className="app-nav-panel player-nav-panel player-nav-panel--compact" aria-label="Player sheet navigation">
          <div className="nav-panel__section">
            <p className="nav-panel__eyebrow">Active Character</p>
            <strong className="nav-panel__title">
              {activeDetail?.instance.name ?? "No sheet claimed"}
            </strong>
            <p className="nav-panel__meta">
              {activeDetail ? `Instance ${activeDetail.instance.id}` : "Claim a sheet to begin."}
            </p>
          </div>

          <div className="nav-panel__section nav-panel__section--tabs">
            <p className="nav-panel__eyebrow">Sheet Sections</p>
            <CharacterSheetTabs activeTab={activeTab} onChange={setActiveTab} />
          </div>
        </aside>

        <main className="app-main-panel app-main-panel--player">
          <div className="player-workspace player-workspace--single">
            <section className={`player-workspace__sheet player-workspace__sheet--${activeTab}`}>
              <PlayerCharacterSheet
                mode="player"
                panelTitle="Character Sheet"
                activeTab={activeTab}
                onActiveTabChange={setActiveTab}
                showTabs={false}
                client={client}
              />
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="main-panel-stack">
      <ActiveSheetSelector />
      <div className="app-grid-player-shell app-grid-player-shell--gm">
        <section className="player-console-main">
          <PlayerCharacterSheet mode={role} panelTitle="Character Sheet" client={client} />
        </section>
        <section className="player-console-side">
          <RollPanel client={client} />
          <RollLog />
        </section>
      </div>
    </div>
  );
}
