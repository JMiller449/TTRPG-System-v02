import { useEffect } from "react";
import { useAppStore } from "@/app/state/store";
import { selectActiveSheetDetail } from "@/app/state/selectors";
import { AuthPanel } from "@/features/auth/AuthPanel";
import { GMPageNavPanel } from "@/features/auth/GMPageNavPanel";
import { PlayerEntry } from "@/features/auth/PlayerEntry";
import { SessionLanding } from "@/features/auth/SessionLanding";
import { ConsolePage } from "@/features/console/ConsolePage";
import { EncounterPanel } from "@/features/encounters/EncounterPanel";
import { EncounterQuickSelectPanel } from "@/features/encounters/EncounterQuickSelectPanel";
import { ItemMakerPage } from "@/features/items/ItemMakerPage";
import { TemplateCreatePage } from "@/features/sheets/TemplateCreatePage";
import { SheetTabs } from "@/features/sheets/SheetTabs";
import { TemplateLibrary } from "@/features/sheets/TemplateLibrary";
import { useGameClient } from "@/hooks/useGameClient";
import { IntentFeedbackBanners } from "@/shared/ui/IntentFeedbackBanners";

export function App(): JSX.Element {
  const { state } = useAppStore();
  const client = useGameClient();
  const { role } = state.serverState;
  const { connection, activeSheetId, gmView, playerSheetSelectionComplete } = state.uiState;
  const activeDetail = selectActiveSheetDetail(state);

  useEffect(() => {
    if (!role || connection.status !== "disconnected") {
      return;
    }
    void client.connect();
  }, [client, connection.status, role]);

  if (!role) {
    return <SessionLanding client={client} />;
  }

  if (role === "player") {
    if (!playerSheetSelectionComplete || !activeDetail || activeDetail.instance.kind !== "player") {
      return <PlayerEntry client={client} />;
    }
  }

  return (
    <div className={`app-shell ${role === "player" ? "app-shell--player" : ""}`}>
      <header className="app-header">
        <h1>TTRPG Sheet Console</h1>
        <div className="header-row">
          <p>
            {role === "gm"
              ? "GM console: full template, encounter, sheet, and rolling controls."
              : "Player console: view your sheet and submit rolls into chat."}
          </p>
          <button
            className="button button--secondary"
            onClick={() => {
              client.endSession();
            }}
          >
            Exit to Code Entry
          </button>
        </div>
      </header>
      <IntentFeedbackBanners />
      {role === "gm" ? <GMPageNavPanel /> : null}

      {role === "player" ? (
        <ConsolePage role="player" client={client} />
      ) : gmView === "template_library" ? (
        <main className="app-grid-player">
          <TemplateLibrary client={client} />
        </main>
      ) : gmView === "create_template" ? (
        <main className="app-grid-player">
          <TemplateCreatePage client={client} />
        </main>
      ) : gmView === "encounter_presets" ? (
        <main className="app-grid-player">
          <EncounterPanel client={client} />
        </main>
      ) : gmView === "item_maker" ? (
        <main className="app-grid-player">
          <ItemMakerPage />
        </main>
      ) : (
        <>
          <section className="gm-console-tools">
            <AuthPanel client={client} />
            <SheetTabs />
            <EncounterQuickSelectPanel client={client} />
          </section>
          <ConsolePage role="gm" client={client} />
        </>
      )}
    </div>
  );
}
