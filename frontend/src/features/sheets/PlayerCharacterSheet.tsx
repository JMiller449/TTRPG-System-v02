import { useEffect, useRef, useState } from "react";
import { CharacterSheetTabs } from "@/features/sheets/components/CharacterSheetTabs";
import { SheetActionsSection } from "@/features/sheets/components/SheetActionsSection";
import { SheetConditionsSection } from "@/features/sheets/components/SheetConditionsSection";
import { SheetEquipmentSection } from "@/features/sheets/components/SheetEquipmentSection";
import { SheetFormulaStatsEditor } from "@/features/sheets/components/SheetFormulaStatsEditor";
import { SheetFactsSection } from "@/features/sheets/components/SheetFactsSection";
import { SheetNotesSection } from "@/features/sheets/components/SheetNotesSection";
import { SheetProficienciesSection } from "@/features/sheets/components/SheetProficienciesSection";
import { SheetResourceHeader } from "@/features/sheets/components/SheetResourceHeader";
import { SheetResistancesEditor } from "@/features/sheets/components/SheetResistancesEditor";
import { SheetStatsSection } from "@/features/sheets/components/SheetStatsSection";
import { SheetStandaloneEffectsSection } from "@/features/sheets/components/SheetStandaloneEffectsSection";
import { SheetKillsSection } from "@/features/xp/SheetKillsSection";
import { useResourceEditor } from "@/features/sheets/hooks/useResourceEditor";
import { useSheetDetailState } from "@/features/sheets/hooks/useSheetDetailState";
import { useStatModifierEditor } from "@/features/sheets/hooks/useStatModifierEditor";
import { buildEquipmentQuantitySubmission } from "@/features/sheets/equipmentQuantity";
import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildAttachSheetActionRequest,
  buildAttachSheetFactRequest,
  buildAttachSheetItemRequest,
  buildDetachSheetActionRequest,
  buildDetachSheetFactRequest,
  buildDetachSheetItemRequest,
  buildGetActionFormulaAuthoringMetadataRequest,
  buildLinkSheetProficiencyRequest,
  buildPerformActionRequest,
  buildResetSheetFactValueRequest,
  buildRelinkSheetActionRequest,
  buildRemoveActiveConditionRequest,
  buildSetInstancedSheetNotesRequest,
  buildSetSheetFactValueRequest,
  buildSetSheetFormulaStatRequest,
  buildSetSheetResistancesRequest,
  buildUnlinkSheetProficiencyRequest,
  buildUpdateAttachedSheetItemRequest,
  buildUpdateLinkedSheetProficiencyRequest
} from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

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
    factDefinitions,
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

  const [localActiveTab, setLocalActiveTab] = useState<PlayerSheetTab>("stats");
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
      setLocalActiveTab("stats");
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

  const showStatsSection = activeTab === "stats";
  const showActionsSection = activeTab === "actions";
  const showConditionsSection = activeTab === "conditions";
  const showEquipmentSection = activeTab === "equipment";
  const showProficienciesSection = activeTab === "proficiencies";
  const showKillsSection = activeTab === "kills";
  const showNotesSection = activeTab === "notes";
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
    <Panel title={panelTitle ?? (mode === "gm" ? "Sheet Detail" : "Character Sheet")}>
      {mode === "gm" ? (
        <p className="character-sheet__panel-subtext muted">Sheet ID: {detail.instance.id}</p>
      ) : null}
      <article className="character-sheet">
        <header className="character-sheet__header">
          <div className="character-sheet__header-main">
            <h3>{detail.instance.name}</h3>
          </div>
          <div className="character-sheet__header-right">
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

        {showTabs ? <CharacterSheetTabs activeTab={activeTab} onChange={setActiveTab} /> : null}

        {showStatsSection ? (
          <div
            role="tabpanel"
            id="sheet-panel-stats"
            aria-labelledby="sheet-tab-stats"
            tabIndex={0}
          >
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
            <SheetFactsSection
              definitions={factDefinitions}
              bridges={detail.sheet?.facts ?? {}}
              canEdit={canEditStats && Boolean(sheetId)}
              compact={mode === "player"}
              onSaveFormula={(factId, formula) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildSetSheetFactValueRequest({
                    sheetId,
                    factId,
                    value: { type: "formula", formula }
                  }),
                  `Update Fact: ${factDefinitions[factId]?.name ?? factId}`
                );
              }}
              onSaveValue={(factId, value) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildSetSheetFactValueRequest({ sheetId, factId, value }),
                  `Update Fact: ${factDefinitions[factId]?.name ?? factId}`
                );
              }}
              onReset={(factId) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildResetSheetFactValueRequest({ sheetId, factId }),
                  `Reset Fact: ${factDefinitions[factId]?.name ?? factId}`
                );
              }}
              onAttach={(factId) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildAttachSheetFactRequest({
                    sheetId,
                    factId,
                    relationshipId: makeId("sheet_fact")
                  }),
                  `Attach Fact: ${factDefinitions[factId]?.name ?? factId}`
                );
              }}
              onDetach={(factId) => {
                if (!sheetId) {
                  return;
                }
                client.sendProtocolRequest(
                  buildDetachSheetFactRequest({ sheetId, factId }),
                  `Detach Fact: ${factDefinitions[factId]?.name ?? factId}`
                );
              }}
            />
            {canEditStats && detail.sheet && sheetId ? (
              <div className="stack">
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
              </div>
            ) : null}
          </div>
        ) : null}

        {showActionsSection ? (
          <div
            role="tabpanel"
            id="sheet-panel-actions"
            aria-labelledby="sheet-tab-actions"
            tabIndex={0}
          >
            <SheetActionsSection
              assignedActions={assignedActions}
              actionDefinitions={actionDefinitions}
              factDefinitions={factDefinitions}
              actionOrder={actionOrder}
              canEdit={canEditActions}
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

        {showConditionsSection ? (
          <div
            role="tabpanel"
            id="sheet-panel-conditions"
            aria-labelledby="sheet-tab-conditions"
            tabIndex={0}
          >
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
          </div>
        ) : null}

        {showNotesSection ? (
          <div
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

        {showKillsSection && sheetId ? (
          <SheetKillsSection client={client} instanceId={detail.instance.id} sheetId={sheetId} />
        ) : null}

        {showProficienciesSection ? (
          <div
            role="tabpanel"
            id="sheet-panel-proficiencies"
            aria-labelledby="sheet-tab-proficiencies"
            tabIndex={0}
          >
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
          </div>
        ) : null}

        {showEquipmentSection ? (
          <div
            role="tabpanel"
            id="sheet-panel-equipment"
            aria-labelledby="sheet-tab-equipment"
            tabIndex={0}
          >
            <SheetEquipmentSection
              items={items}
              actionDefinitions={actionDefinitions}
              factDefinitions={factDefinitions}
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
      </article>
    </Panel>
  );
}
