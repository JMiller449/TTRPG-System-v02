import { useEffect, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { selectActiveSheetDetail } from "@/app/state/selectors";
import type { GameClient } from "@/hooks/useGameClient";
import { PlayerCharacterSheet } from "@/features/sheets/PlayerCharacterSheet";
import { ExtensionPage } from "@/features/extension/ExtensionPage";

export function ConsolePage({ client }: { client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const activeDetail = selectActiveSheetDetail(state);
  const [showExtension, setShowExtension] = useState(false);

  useEffect(() => {
    setShowExtension(false);
  }, [activeDetail?.instance.id]);

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
          <p className="nav-panel__eyebrow">Workspace</p>
          <button
            type="button"
            className={`player-nav-panel__destination ${
              !showExtension ? "player-nav-panel__destination--active" : ""
            }`}
            aria-pressed={!showExtension}
            onClick={() => setShowExtension(false)}
          >
            Character Sheet
          </button>
          <button
            type="button"
            className={`player-nav-panel__destination ${
              showExtension ? "player-nav-panel__destination--active" : ""
            }`}
            aria-pressed={showExtension}
            onClick={() => setShowExtension(true)}
          >
            Install / Sync Bridge
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
            <section className="player-workspace__sheet">
              <PlayerCharacterSheet mode="player" client={client} />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
