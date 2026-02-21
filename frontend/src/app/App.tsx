import { useEffect } from "react";
import { useAppStore } from "@/app/state/store";
import { AuthPanel } from "@/features/auth/AuthPanel";
import { PlayerEntry } from "@/features/auth/PlayerEntry";
import { SessionLanding } from "@/features/auth/SessionLanding";
import { EncounterPanel } from "@/features/encounters/EncounterPanel";
import { RollLog } from "@/features/rolls/RollLog";
import { RollPanel } from "@/features/rolls/RollPanel";
import { TemplateCreatePage } from "@/features/sheets/TemplateCreatePage";
import { PlayerCharacterSheet } from "@/features/sheets/PlayerCharacterSheet";
import { LevelUpPanel } from "@/features/sheets/LevelUpPanel";
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
    <div className="app-shell">
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

      {role === "player" ? (
        <main className="app-grid-player">
          <PlayerCharacterSheet client={client} mode="player" panelTitle="Character Sheet" />
          <LevelUpPanel />
          <RollLog sheetId={activeSheetId} client={client} />
        </main>
      ) : gmView === "create_template" ? (
        <main className="app-grid-player">
          <TemplateCreatePage client={client} />
        </main>
      ) : (
        <main className="app-grid">
          <aside className="app-column">
            <AuthPanel client={client} />
            <TemplateLibrary client={client} />
            <EncounterPanel client={client} />
          </aside>

          <section className="app-column app-column--wide">
            <SheetTabs client={client} />
            <PlayerCharacterSheet client={client} mode="gm" panelTitle="Sheet Detail" />
            <LevelUpPanel />
            <RollPanel client={client} />
            <RollLog />
          </section>
        </main>
      )}
    </div>
  );
}
