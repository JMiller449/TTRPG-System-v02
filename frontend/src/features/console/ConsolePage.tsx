import { useEffect, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { selectActiveSheetDetail } from "@/app/state/selectors";
import type { Role } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { SheetAccessCodesPanel } from "@/features/auth/SheetAccessCodesPanel";
import { RollPanel } from "@/features/rolls/RollPanel";
import { PlayerCharacterSheet } from "@/features/sheets/PlayerCharacterSheet";
import { CharacterSheetTabs } from "@/features/sheets/components/CharacterSheetTabs";
import { ExtensionPage } from "@/features/extension/ExtensionPage";
import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";

export function ConsolePage({ role, client }: { role: Role; client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const activeDetail = selectActiveSheetDetail(state);
  const [activeTab, setActiveTab] = useState<PlayerSheetTab>("overview");
  const [showExtension, setShowExtension] = useState(false);

  useEffect(() => {
    setActiveTab("overview");
    setShowExtension(false);
  }, [activeDetail?.instance.id]);

  if (role === "player") {
    return (
      <div className="app-layout app-layout--player">
        <aside
          className="app-nav-panel player-nav-panel player-nav-panel--compact"
          aria-label="Player sheet navigation"
        >
          <div className="nav-panel__section">
            <p className="nav-panel__eyebrow">Active Character</p>
            <strong className="nav-panel__title">
              {activeDetail?.instance.name ?? "No sheet claimed"}
            </strong>
            <p className="nav-panel__meta">
              {activeDetail ? "Player character" : "Claim a sheet to begin."}
            </p>
          </div>

          <div className="nav-panel__section nav-panel__section--tabs">
            <p className="nav-panel__eyebrow">Sheet Sections</p>
            <CharacterSheetTabs
              activeTab={activeTab}
              onChange={(tab) => {
                setActiveTab(tab);
                setShowExtension(false);
              }}
            />
          </div>

          <div className="nav-panel__section nav-panel__section--tabs">
            <p className="nav-panel__eyebrow">Tools</p>
            <button
              type="button"
              className={`character-sheet__tab ${showExtension ? "character-sheet__tab--active" : ""}`}
              aria-pressed={showExtension}
              onClick={() => setShowExtension(true)}
            >
              Extension
            </button>
          </div>
        </aside>

        <main className="app-main-panel app-main-panel--player">
          <div className="player-workspace player-workspace--single">
            {showExtension ? (
              <section className="player-workspace__sheet player-workspace__sheet--extension">
                <ExtensionPage client={client} />
              </section>
            ) : (
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
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="main-panel-stack main-panel-stack--console main-panel-stack--dashboard">
      <div className="gm-dashboard-tools">
        <SheetAccessCodesPanel client={client} />
        <RollPanel client={client} />
      </div>
    </div>
  );
}
