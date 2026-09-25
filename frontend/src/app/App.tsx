import { useEffect, useState } from "react";
import { shouldConnectApp } from "@/app/appConnection";
import { useAppStore } from "@/app/state/useAppStore";
import { selectActiveSheetDetail } from "@/app/state/selectors";
import { ActionAuthoringPage } from "@/features/actions/ActionAuthoringPage";
import { PlayerEntry } from "@/features/auth/PlayerEntry";
import { SessionLanding } from "@/features/auth/SessionLanding";
import { ConditionAuthoringPage } from "@/features/conditions/ConditionAuthoringPage";
import { ConsolePage } from "@/features/console/ConsolePage";
import { ConsoleSidebar } from "@/features/console/ConsoleSidebar";
import { EncounterPanel } from "@/features/encounters/EncounterPanel";
import { StandaloneEffectAuthoringPage } from "@/features/effects/StandaloneEffectAuthoringPage";
import { FormulaAuthoringPage } from "@/features/formulas/FormulaAuthoringPage";
import { ExtensionPage } from "@/features/extension/ExtensionPage";
import { AttributeAuthoringPage } from "@/features/attributes/AttributeAuthoringPage";
import { ItemMakerPage } from "@/features/items/ItemMakerPage";
import { ItemTemplateBuilderPage } from "@/features/items/ItemTemplateBuilderPage";
import { ProficiencyAuthoringPage } from "@/features/proficiencies/ProficiencyAuthoringPage";
import { RollLog } from "@/features/rolls/RollLog";
import { SheetViewerPage } from "@/features/sheets/SheetViewerPage";
import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";
import { StateSafetyPanel } from "@/features/stateSync/StateSafetyPanel";
import { StateBackupPage } from "@/features/stateBackup/StateBackupPage";
import { TemplateCreatePage } from "@/features/sheets/TemplateCreatePage";
import { TemplateLibrary } from "@/features/sheets/TemplateLibrary";
import { useGameClient } from "@/hooks/useGameClient";
import { XpTrackerPage } from "@/features/xp/XpTrackerPage";
import { TagAuthoringPage } from "@/features/tags/TagAuthoringPage";
import { IntentFeedbackToasts } from "@/shared/ui/IntentFeedbackBanners";

export function App(): JSX.Element {
  const { state, dispatch } = useAppStore();
  const client = useGameClient();
  const [activeCharacterSection, setActiveCharacterSection] = useState<PlayerSheetTab>("dense");
  const { role } = state.serverState;
  const { connection, gmView, playerSheetSelectionComplete } = state.uiState;
  const activeDetail = selectActiveSheetDetail(state);

  useEffect(() => {
    if (!shouldConnectApp(connection.status)) {
      return;
    }
    void client.connect();
  }, [client, connection.status]);

  useEffect(() => {
    setActiveCharacterSection("dense");
  }, [role]);

  if (!role) {
    return <SessionLanding client={client} />;
  }

  if (role === "player") {
    if (!playerSheetSelectionComplete || !activeDetail || activeDetail.instance.kind !== "player") {
      return <PlayerEntry client={client} />;
    }
  }

  const gmContent =
    gmView === "action_history" ? (
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
    ) : gmView === "item_template_builder" ? (
      <ItemTemplateBuilderPage client={client} />
    ) : gmView === "formula_authoring" ? (
      <FormulaAuthoringPage client={client} />
    ) : gmView === "attribute_authoring" ? (
      <AttributeAuthoringPage client={client} />
    ) : gmView === "proficiency_authoring" ? (
      <ProficiencyAuthoringPage client={client} />
    ) : gmView === "tag_authoring" ? (
      <TagAuthoringPage client={client} />
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
      <SheetViewerPage
        client={client}
        activeSection={activeCharacterSection}
        onSectionChange={setActiveCharacterSection}
      />
    );

  return (
    <div className={`r6-theme app-shell ${role === "player" ? "app-shell--player" : ""}`}>
      <IntentFeedbackToasts />

      {role === "player" ? (
        <ConsolePage client={client} />
      ) : (
        <div className="app-layout app-layout--gm">
          <ConsoleSidebar
            role="gm"
            client={client}
            activeView={gmView}
            activeCharacterSection={activeCharacterSection}
            onCharacterSectionChange={setActiveCharacterSection}
            onNavigate={(view) => {
              if (view === "create_template") {
                dispatch({ type: "set_template_builder_sheet", sheetId: null });
              }
              dispatch({ type: "set_gm_view", view });
            }}
          />
          <main className="app-main-panel app-main-panel--gm">{gmContent}</main>
        </div>
      )}
    </div>
  );
}
