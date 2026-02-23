import { useEffect } from "react";
import { useAppStore } from "@/app/state/store";
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
  const { state, dispatch } = useAppStore();
  const client = useGameClient();
  const { role, connection, instances, activeSheetId, gmView } = state;

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
    const active = activeSheetId ? instances[activeSheetId] : null;
    if (!active || active.kind !== "player") {
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
              : "Player console: view your sheet, submit rolls, and review your roll log."}
          </p>
          <button
            className="button button--secondary"
            onClick={() => {
              dispatch({ type: "set_role", role: null });
              dispatch({ type: "set_gm_authenticated", value: false });
              dispatch({ type: "set_gm_password", password: "" });
              dispatch({ type: "set_gm_view", view: "console" });
            }}
          >
            Exit to Session
          </button>
        </div>
      </header>
      <IntentFeedbackBanners />
      {role === "gm" ? <GMPageNavPanel /> : null}

      {role === "player" ? (
        <ConsolePage role="player" client={client} activeSheetId={activeSheetId} />
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
            <SheetTabs client={client} />
            <EncounterQuickSelectPanel client={client} />
          </section>
          <ConsolePage role="gm" client={client} activeSheetId={activeSheetId} />
        </>
      )}
    </div>
  );
}
