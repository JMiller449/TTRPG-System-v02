import { useEffect } from "react";
import { shouldConnectApp } from "@/app/appConnection";
import { useAppStore } from "@/app/state/useAppStore";
import { selectActiveSheetDetail } from "@/app/state/selectors";
import { ActionAuthoringPage } from "@/features/actions/ActionAuthoringPage";
import { PlayerEntry } from "@/features/auth/PlayerEntry";
import { SessionLanding } from "@/features/auth/SessionLanding";
import { ConditionAuthoringPage } from "@/features/conditions/ConditionAuthoringPage";
import { ConsolePage } from "@/features/console/ConsolePage";
import { AppStatusBar } from "@/features/console/AppStatusBar";
import { GMConsoleToolbar } from "@/features/console/GMConsoleToolbar";
import { EncounterPanel } from "@/features/encounters/EncounterPanel";
import { StandaloneEffectAuthoringPage } from "@/features/effects/StandaloneEffectAuthoringPage";
import { FormulaAuthoringPage } from "@/features/formulas/FormulaAuthoringPage";
import { ExtensionPage } from "@/features/extension/ExtensionPage";
import { AttributeAuthoringPage } from "@/features/attributes/AttributeAuthoringPage";
import { ItemMakerPage } from "@/features/items/ItemMakerPage";
import { ProficiencyAuthoringPage } from "@/features/proficiencies/ProficiencyAuthoringPage";
import { RollLog } from "@/features/rolls/RollLog";
import { SheetViewerPage } from "@/features/sheets/SheetViewerPage";
import { StateSafetyPanel } from "@/features/stateSync/StateSafetyPanel";
import { StateBackupPage } from "@/features/stateBackup/StateBackupPage";
import { TemplateCreatePage } from "@/features/sheets/TemplateCreatePage";
import { TemplateLibrary } from "@/features/sheets/TemplateLibrary";
import { useGameClient } from "@/hooks/useGameClient";
import { XpTrackerPage } from "@/features/xp/XpTrackerPage";
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

  const gmContent =
    gmView === "sheet_viewer" ? (
      <SheetViewerPage client={client} />
    ) : gmView === "action_history" ? (
      <RollLog />
    ) : gmView === "template_library" ? (
      <TemplateLibrary client={client} />
    ) : gmView === "create_template" ? (
      <TemplateCreatePage client={client} />
    ) : gmView === "encounter_presets" ? (
      <EncounterPanel client={client} />
    ) : gmView === "xp_tracker" ? (
      <XpTrackerPage client={client} />
    ) : gmView === "item_maker" ? (
      <ItemMakerPage client={client} />
    ) : gmView === "formula_authoring" ? (
      <FormulaAuthoringPage client={client} />
    ) : gmView === "attribute_authoring" ? (
      <AttributeAuthoringPage client={client} />
    ) : gmView === "proficiency_authoring" ? (
      <ProficiencyAuthoringPage client={client} />
    ) : gmView === "condition_authoring" ? (
      <ConditionAuthoringPage client={client} />
    ) : gmView === "effect_authoring" ? (
      <StandaloneEffectAuthoringPage client={client} />
    ) : gmView === "action_authoring" ? (
      <ActionAuthoringPage client={client} />
    ) : gmView === "state_backup" ? (
      <div className="main-panel-stack">
        <StateSafetyPanel client={client} />
        <StateBackupPage client={client} />
      </div>
    ) : gmView === "extension" ? (
      <ExtensionPage client={client} />
    ) : (
      <div className="main-panel-stack main-panel-stack--dashboard">
        <ConsolePage role="gm" client={client} />
      </div>
    );

  return (
    <div className={`r6-theme app-shell ${role === "player" ? "app-shell--player" : ""}`}>
      <AppStatusBar role={role} client={client} />
      <div className="app-notification-slot">
        <IntentFeedbackBanners />
      </div>

      {role === "player" ? (
        <ConsolePage role="player" client={client} />
      ) : (
        <div className="app-layout app-layout--gm">
          <GMConsoleToolbar />
          <main className="app-main-panel app-main-panel--gm">{gmContent}</main>
        </div>
      )}
    </div>
  );
}
