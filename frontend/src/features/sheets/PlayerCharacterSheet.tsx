import { useEffect, useRef, useState } from "react";
import { CharacterSheetTabs } from "@/features/sheets/components/CharacterSheetTabs";
import { SheetActionsSection } from "@/features/sheets/components/SheetActionsSection";
import { SheetConditionsSection } from "@/features/sheets/components/SheetConditionsSection";
import { SheetEquipmentSection } from "@/features/sheets/components/SheetEquipmentSection";
import { SheetFormulaStatsEditor } from "@/features/sheets/components/SheetFormulaStatsEditor";
import { SheetAttributesSection } from "@/features/sheets/components/SheetAttributesSection";
import { SheetNotesSection } from "@/features/sheets/components/SheetNotesSection";
import { SheetProficienciesSection } from "@/features/sheets/components/SheetProficienciesSection";
import { SheetResourceHeader } from "@/features/sheets/components/SheetResourceHeader";
import { SheetResistancesEditor } from "@/features/sheets/components/SheetResistancesEditor";
import { SheetStatsSection } from "@/features/sheets/components/SheetStatsSection";
import { SheetStandaloneEffectsSection } from "@/features/sheets/components/SheetStandaloneEffectsSection";
import { RollLog } from "@/features/rolls/RollLog";
import { SheetKillsSection } from "@/features/xp/SheetKillsSection";
import { useResourceEditor } from "@/features/sheets/hooks/useResourceEditor";
import { useSheetDetailState } from "@/features/sheets/hooks/useSheetDetailState";
import { useStatModifierEditor } from "@/features/sheets/hooks/useStatModifierEditor";
import { buildEquipmentQuantitySubmission } from "@/features/sheets/equipmentQuantity";
import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildAttachSheetActionRequest,
  buildAttachSheetAttributeRequest,
  buildAttachSheetItemRequest,
  buildDetachSheetActionRequest,
  buildDetachSheetAttributeRequest,
  buildDetachSheetItemRequest,
  buildGetActionFormulaAuthoringMetadataRequest,
  buildLinkSheetProficiencyRequest,
  buildPerformActionRequest,
  buildResetSheetAttributeValueRequest,
  buildRelinkSheetActionRequest,
  buildRemoveActiveConditionRequest,
  buildSetInstancedSheetNotesRequest,
  buildSetSheetAttributeValueRequest,
  buildSetSheetFormulaStatRequest,
  buildSetSheetResistancesRequest,
  buildUnlinkSheetProficiencyRequest,
  buildUpdateAttachedSheetItemRequest,
  buildUpdateLinkedSheetProficiencyRequest
} from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

function sheetInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "--";
  }
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function PlayerCharacterSheet({
  mode = "player",
  panelTitle,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  showTabs = true,
  client
}: {
  mode?: "player" | "gm";
  panelTitle?: string;
  activeTab?: PlayerSheetTab;
  onActiveTabChange?: (tab: PlayerSheetTab) => void;
  showTabs?: boolean;
  client: GameClient;
}): JSX.Element {
  const {
    detail,
    actionDefinitions,
    actionOrder,
    augmentations,
    attributeDefinitions,
    actionFormulaAuthoringMetadata,
    items,
    itemOrder,
    proficiencyDefinitions,
    proficiencyOrder,
    runtimeNote,
    equipment,
    sheetProficiencies,
    assignedActions,
    activeConditions,
    activeStandaloneEffects,
    selectedItemId,
    selectedItem,
    setSelectedItemId
  } = useSheetDetailState();

  const [localActiveTab, setLocalActiveTab] = useState<PlayerSheetTab>("overview");
  const requestedFormulaMetadataRef = useRef(false);
  const activeTab = controlledActiveTab ?? localActiveTab;
  const setActiveTab = onActiveTabChange ?? setLocalActiveTab;

  const statEditor = useStatModifierEditor({
    resetToken: detail?.instance.id,
    sheetId: detail?.sheet?.id,
    baseStats: detail?.stats ?? {},
    client
  });

  const resourceEditor = useResourceEditor({
    resetToken: detail?.instance.id,
    instanceId: detail?.instance.id,
    baseHealth: detail?.stats.health ?? 0,
    baseMana: detail?.stats.mana ?? 0,
    client
  });

  useEffect(() => {
    if (!controlledActiveTab) {
      setLocalActiveTab("overview");
    }
  }, [controlledActiveTab, detail?.instance.id]);

  useEffect(() => {
    if (mode !== "gm" || actionFormulaAuthoringMetadata || requestedFormulaMetadataRef.current) {
      return;
    }
    requestedFormulaMetadataRef.current = true;
    client.sendProtocolRequest(
      buildGetActionFormulaAuthoringMetadataRequest(),
      "Load sheet formula metadata"
    );
  }, [actionFormulaAuthoringMetadata, client, mode]);

  if (!detail) {
    return (
      <Panel title="Character Sheet">
        <EmptyState message="No active sheet selected." />
      </Panel>
    );
  }

  const showOverviewSection = activeTab === "overview";
  const showActionsSection = activeTab === "actions";
  const showInventorySection = activeTab === "inventory";
  const showDetailsSection = activeTab === "details";
  const showNotesSection = activeTab === "notes";
  const showActionHistorySection = mode === "gm" && activeTab === "action_history";
  const showFormulaStatsSection = mode === "gm" && activeTab === "formula_stats";
  const showResistancesSection = mode === "gm" && activeTab === "resistances";
  const canEditStats = mode === "gm";
  const canEditActions = mode === "gm";
  const canEditEquipment = mode === "gm";
  const canEditProficiencies = mode === "gm";
  const sheetId = detail.sheet?.id;

  const updateEquipmentBridgeEquipped = (relationshipId: string, equipped: boolean): void => {
    if (!sheetId) {
      return;
    }

    const bridge = equipment.find((entry) => entry.relationship_id === relationshipId);
    if (!bridge) {
      return;
    }

    client.sendProtocolRequest(
      buildUpdateAttachedSheetItemRequest({
        sheetId,
        relationshipId,
        bridge: {
          ...bridge,
          equipped
        }
      }),
      equipped ? "Equip item" : "Unequip item"
    );
  };

  return (
    <Panel
      title={panelTitle ?? (mode === "gm" ? "Sheet Detail" : "Character Sheet")}
      className="sheet-panel"
    >
      {mode === "gm" ? (
        <p className="character-sheet__panel-subtext muted">Sheet ID: {detail.instance.id}</p>
      ) : null}
      <article className="character-sheet">
        <header className="character-sheet__header">
          <div className="character-sheet__identity-mark" aria-hidden="true">
            {sheetInitials(detail.instance.name)}
          </div>
          <div className="character-sheet__header-main">
            <h3>{detail.instance.name}</h3>
            <p>{mode === "gm" ? "GM-controlled sheet workspace" : "Active character sheet"}</p>
          </div>
          <div className="character-sheet__header-resources">
            <SheetResourceHeader
              stats={detail.stats}
              resources={resourceEditor.resources}
              editingResource={resourceEditor.editingResource}
              resourceDraftModifier={resourceEditor.resourceDraftModifier}
              healthDamageType={resourceEditor.healthDamageType}
              resourceEditorError={resourceEditor.resourceEditorError}
              onBeginResourceEdit={resourceEditor.beginResourceEdit}
              onResourceDraftModifierChange={resourceEditor.setResourceDraftModifier}
              onHealthDamageTypeChange={resourceEditor.setHealthDamageType}
              onApplyResourceModifier={resourceEditor.applyResourceModifier}
              onCancelResourceEdit={resourceEditor.cancelResourceEdit}
              onResourceEditorKeyDown={resourceEditor.onResourceEditorKeyDown}
            />
          </div>
        </header>

        {showTabs ? (
          <CharacterSheetTabs activeTab={activeTab} onChange={setActiveTab} mode={mode} />
        ) : null}

        {showOverviewSection ? (
          <div
            className="character-sheet__tab-panel"
            role="tabpanel"
            id="sheet-panel-overview"
            aria-labelledby="sheet-tab-overview"
            tabIndex={0}
          >
            <div className="character-sheet__overview-grid">
              <div className="character-sheet__overview-main">
                <SheetStatsSection
                  canEditStats={canEditStats}
                  compact={mode === "player"}
                  stats={detail.stats}
                  editingKey={statEditor.editingKey}
                  draftModifier={statEditor.draftModifier}
                  editorError={statEditor.editorError}
                  getModifier={statEditor.getModifier}
                  getCurrentValue={statEditor.getCurrentValue}
                  onBeginEditing={statEditor.beginEditing}
                  onApplyModifier={statEditor.applyModifier}
                  onResetModifier={statEditor.resetModifier}
                  onDraftModifierChange={statEditor.setDraftModifier}
                  onCancelEditing={statEditor.cancelEditing}
                  onEditorKeyDown={statEditor.onEditorKeyDown}
                />
              </div>
              <aside className="character-sheet__overview-side">
                <SheetConditionsSection
                  conditions={activeConditions}
                  canRemove={mode === "gm"}
                  onRemove={(applicationId) =>
                    client.sendProtocolRequest(
                      buildRemoveActiveConditionRequest({
                        instanceId: detail.instance.id,
                        applicationId
                      }),
                      "Remove active condition"
                    )
                  }
                />
                <SheetStandaloneEffectsSection effects={activeStandaloneEffects} />
              </aside>
            </div>
            {mode === "player" && assignedActions.length > 0 ? (
              <section className="character-sheet__section" aria-label="Pinned Actions">
                <SheetActionsSection
                  assignedActions={assignedActions.slice(0, 6)}
                  actionDefinitions={actionDefinitions}
                  attributeDefinitions={attributeDefinitions}
                  actionOrder={actionOrder}
                  canEdit={false}
                  compact
                  onCreate={() => undefined}
                  onUpdate={() => undefined}
                  onDelete={() => undefined}
                  onPerformAction={(action, rollMode) => {
                    client.sendProtocolRequest(
                      buildPerformActionRequest({
                        sheetId: detail.instance.id,
                        actionId: action.actionId,
                        sourceItemRelationshipId: action.sourceItemRelationshipId,
                        rollMode
                      }),
                      `Perform action: ${action.action.name}`
                    );
                  }}
                />
              </section>
            ) : null}
          </div>
        ) : null}

        {showActionsSection ? (
          <div
            className="character-sheet__tab-panel"
            role="tabpanel"
            id="sheet-panel-actions"
            aria-labelledby="sheet-tab-actions"
            tabIndex={0}
          >
            <SheetActionsSection
              assignedActions={assignedActions}
              actionDefinitions={actionDefinitions}
              attributeDefinitions={attributeDefinitions}
              actionOrder={actionOrder}
              canEdit={canEditActions}
              commandLayout={mode === "gm"}
              onCreate={(bridge) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildAttachSheetActionRequest({ sheetId, bridge }),
                  `Assign action: ${actionDefinitions[bridge.action_id]?.name ?? bridge.action_id}`
                );
              }}
              onUpdate={(relationshipId, bridge) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildRelinkSheetActionRequest({ sheetId, relationshipId, bridge }),
                  `Replace action: ${actionDefinitions[bridge.action_id]?.name ?? bridge.action_id}`
                );
              }}
              onDelete={(relationshipId) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildDetachSheetActionRequest({ sheetId, relationshipId }),
                  "Remove action assignment"
                );
              }}
              onPerformAction={(action, rollMode) => {
                client.sendProtocolRequest(
                  buildPerformActionRequest({
                    sheetId: detail.instance.id,
                    actionId: action.actionId,
                    sourceItemRelationshipId: action.sourceItemRelationshipId,
                    rollMode
                  }),
                  `Perform action: ${action.action.name}`
                );
              }}
            />
          </div>
        ) : null}

        {showDetailsSection ? (
          <div
            className="character-sheet__tab-panel"
            role="tabpanel"
            id="sheet-panel-details"
            aria-labelledby="sheet-tab-details"
            tabIndex={0}
          >
            <SheetAttributesSection
              definitions={attributeDefinitions}
              bridges={detail.sheet?.attributes ?? {}}
              canEdit={canEditStats && Boolean(sheetId)}
              compact={mode === "player"}
              onSaveFormula={(attributeId, formula) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildSetSheetAttributeValueRequest({
                    sheetId,
                    attributeId,
                    value: { type: "formula", formula }
                  }),
                  `Update Attribute: ${attributeDefinitions[attributeId]?.name ?? attributeId}`
                );
              }}
              onSaveValue={(attributeId, value) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildSetSheetAttributeValueRequest({ sheetId, attributeId, value }),
                  `Update Attribute: ${attributeDefinitions[attributeId]?.name ?? attributeId}`
                );
              }}
              onReset={(attributeId) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildResetSheetAttributeValueRequest({ sheetId, attributeId }),
                  `Reset Attribute: ${attributeDefinitions[attributeId]?.name ?? attributeId}`
                );
              }}
              onAttach={(attributeId) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildAttachSheetAttributeRequest({
                    sheetId,
                    attributeId,
                    relationshipId: makeId("sheet_attribute")
                  }),
                  `Attach Attribute: ${attributeDefinitions[attributeId]?.name ?? attributeId}`
                );
              }}
              onDetach={(attributeId) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildDetachSheetAttributeRequest({ sheetId, attributeId }),
                  `Detach Attribute: ${attributeDefinitions[attributeId]?.name ?? attributeId}`
                );
              }}
            />
            <SheetProficienciesSection
              proficiencyDefinitions={proficiencyDefinitions}
              proficiencyOrder={proficiencyOrder}
              sheetProficiencies={sheetProficiencies}
              canEdit={canEditProficiencies}
              onCreate={(bridge) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildLinkSheetProficiencyRequest({
                    sheetId,
                    bridge
                  }),
                  `Assign proficiency: ${proficiencyDefinitions[bridge.prof_id]?.name ?? bridge.prof_id}`
                );
              }}
              onUpdate={(relationshipId, bridge) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildUpdateLinkedSheetProficiencyRequest({
                    sheetId,
                    relationshipId,
                    bridge
                  }),
                  `Update proficiency: ${proficiencyDefinitions[bridge.prof_id]?.name ?? bridge.prof_id}`
                );
              }}
              onDelete={(relationshipId) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildUnlinkSheetProficiencyRequest({
                    sheetId,
                    relationshipId
                  }),
                  "Remove proficiency"
                );
              }}
            />
            {sheetId ? (
              <SheetKillsSection client={client} instanceId={detail.instance.id} sheetId={sheetId} />
            ) : null}
          </div>
        ) : null}

        {showNotesSection ? (
          <div
            className="character-sheet__tab-panel"
            role="tabpanel"
            id="sheet-panel-notes"
            aria-labelledby="sheet-tab-notes"
            tabIndex={0}
          >
            <SheetNotesSection
              sheetId={detail.instance.id}
              note={runtimeNote}
              onSave={(note) =>
                client.sendProtocolRequest(
                  buildSetInstancedSheetNotesRequest({
                    instanceId: detail.instance.id,
                    notes: note
                  }),
                  "Update instance notes"
                )
              }
            />
          </div>
        ) : null}

        {showInventorySection ? (
          <div
            className="character-sheet__tab-panel"
            role="tabpanel"
            id="sheet-panel-inventory"
            aria-labelledby="sheet-tab-inventory"
            tabIndex={0}
          >
            <SheetEquipmentSection
              items={items}
              actionDefinitions={actionDefinitions}
              attributeDefinitions={attributeDefinitions}
              augmentations={augmentations}
              itemOrder={itemOrder}
              selectedItemId={selectedItemId}
              selectedItem={selectedItem}
              equipment={equipment}
              canEdit={canEditEquipment}
              onSelectedItemIdChange={setSelectedItemId}
              onAddSelectedItem={() => {
                if (!sheetId || !selectedItem) {
                  return;
                }

                const relationshipId = makeId("item_bridge");
                client.sendProtocolRequest(
                  buildAttachSheetItemRequest({
                    sheetId,
                    bridge: {
                      relationship_id: relationshipId,
                      item_id: selectedItem.id,
                      count: 1,
                      equipped: false
                    }
                  }),
                  "Add equipment"
                );
              }}
              onQuantityChange={(relationshipId, count) => {
                if (!sheetId) {
                  return;
                }
                const bridge = equipment.find((entry) => entry.relationship_id === relationshipId);
                const item = bridge ? items[bridge.item_id] : undefined;
                if (!bridge || !item) {
                  return;
                }
                const submission = buildEquipmentQuantitySubmission({
                  sheetId,
                  bridge,
                  count,
                  itemName: item.name
                });
                if (!submission) {
                  return;
                }
                client.sendProtocolRequest(submission.request, submission.label);
              }}
              onToggleEquipped={(relationshipId) => {
                const bridge = equipment.find((entry) => entry.relationship_id === relationshipId);
                if (!bridge) {
                  return;
                }
                updateEquipmentBridgeEquipped(relationshipId, !bridge.equipped);
              }}
              onRemoveInventoryItem={(relationshipId) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildDetachSheetItemRequest({
                    sheetId,
                    relationshipId
                  }),
                  "Remove equipment"
                );
              }}
            />
          </div>
        ) : null}

        {showActionHistorySection ? (
          <div
            className="character-sheet__tab-panel character-sheet__tab-panel--tool"
            role="tabpanel"
            id="sheet-panel-action_history"
            aria-labelledby="sheet-tab-action_history"
            tabIndex={0}
          >
            <RollLog />
          </div>
        ) : null}

        {showFormulaStatsSection ? (
          <div
            className="character-sheet__tab-panel"
            role="tabpanel"
            id="sheet-panel-formula_stats"
            aria-labelledby="sheet-tab-formula_stats"
            tabIndex={0}
          >
            {canEditStats && detail.sheet && sheetId ? (
              <SheetFormulaStatsEditor
                stats={detail.sheet.stats}
                metadata={actionFormulaAuthoringMetadata}
                onSave={(statName, formula) =>
                  client.sendProtocolRequest(
                    buildSetSheetFormulaStatRequest({
                      sheetId,
                      statName,
                      formula
                    }),
                    `Update formula stat: ${statName}`
                  )
                }
              />
            ) : (
              <EmptyState message="No template formula stats available." />
            )}
          </div>
        ) : null}

        {showResistancesSection ? (
          <div
            className="character-sheet__tab-panel"
            role="tabpanel"
            id="sheet-panel-resistances"
            aria-labelledby="sheet-tab-resistances"
            tabIndex={0}
          >
            {canEditStats && detail.sheet && sheetId ? (
              <SheetResistancesEditor
                resistances={detail.sheet.resistances}
                onSave={(resistances) =>
                  client.sendProtocolRequest(
                    buildSetSheetResistancesRequest({
                      sheetId,
                      resistances
                    }),
                    "Update template resistances"
                  )
                }
              />
            ) : (
              <EmptyState message="No template resistances available." />
            )}
          </div>
        ) : null}
      </article>
    </Panel>
  );
}
