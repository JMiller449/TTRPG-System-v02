import { useEffect } from "react";
import { shouldConnectApp } from "@/app/appConnection";
import { useAppStore } from "@/app/state/useAppStore";
import { selectActiveSheetDetail } from "@/app/state/selectors";
import { ActionAuthoringPage } from "@/features/actions/ActionAuthoringPage";
import { AuthPanel } from "@/features/auth/AuthPanel";
import { GMPageNavPanel } from "@/features/auth/GMPageNavPanel";
import { PlayerEntry } from "@/features/auth/PlayerEntry";
import { SessionLanding } from "@/features/auth/SessionLanding";
import { SheetAccessCodesPanel } from "@/features/auth/SheetAccessCodesPanel";
import { ConditionAuthoringPage } from "@/features/conditions/ConditionAuthoringPage";
import { ConsolePage } from "@/features/console/ConsolePage";
import { GMConsoleOverlay } from "@/features/console/GMConsoleOverlay";
import { EncounterPanel } from "@/features/encounters/EncounterPanel";
import { EncounterQuickSelectPanel } from "@/features/encounters/EncounterQuickSelectPanel";
import { FormulaAuthoringPage } from "@/features/formulas/FormulaAuthoringPage";
import { ItemMakerPage } from "@/features/items/ItemMakerPage";
import { ProficiencyAuthoringPage } from "@/features/proficiencies/ProficiencyAuthoringPage";
import { SheetViewerPage } from "@/features/sheets/SheetViewerPage";
import { StateBackupPage } from "@/features/stateBackup/StateBackupPage";
import { TemplateCreatePage } from "@/features/sheets/TemplateCreatePage";
import { SheetTabs } from "@/features/sheets/SheetTabs";
import { TemplateLibrary } from "@/features/sheets/TemplateLibrary";
import { useGameClient } from "@/hooks/useGameClient";
import { IntentFeedbackBanners } from "@/shared/ui/IntentFeedbackBanners";

export function App(): JSX.Element {
  const { state } = useAppStore();
  const client = useGameClient();
  const { role } = state.serverState;
  const { connection, gmView, playerSheetSelectionComplete } = state.uiState;
  const activeDetail = selectActiveSheetDetail(state);

  useEffect(() => {
    if (!shouldConnectApp(connection.status)) {
      return;
    }
    void client.connect();
  }, [client, connection.status]);

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
      {role === "gm" ? <SheetAccessCodesPanel client={client} /> : null}
      {role === "gm" ? <GMConsoleOverlay client={client} /> : null}

      {role === "player" ? (
        <ConsolePage role="player" client={client} />
      ) : gmView === "sheet_viewer" ? (
        <main className="app-grid-player">
          <SheetViewerPage client={client} />
        </main>
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
          <ItemMakerPage client={client} />
        </main>
      ) : gmView === "formula_authoring" ? (
        <main className="app-grid-player">
          <FormulaAuthoringPage client={client} />
        </main>
      ) : gmView === "proficiency_authoring" ? (
        <main className="app-grid-player">
          <ProficiencyAuthoringPage client={client} />
        </main>
      ) : gmView === "condition_authoring" ? (
        <main className="app-grid-player">
          <ConditionAuthoringPage client={client} />
        </main>
      ) : gmView === "action_authoring" ? (
        <main className="app-grid-player">
          <ActionAuthoringPage client={client} />
        </main>
      ) : gmView === "state_backup" ? (
        <main className="app-grid-player">
          <StateBackupPage client={client} />
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
