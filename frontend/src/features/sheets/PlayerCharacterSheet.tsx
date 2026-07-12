import { useEffect, useRef, useState } from "react";
import { CharacterSheetTabs } from "@/features/sheets/components/CharacterSheetTabs";
import { SheetActionsSection } from "@/features/sheets/components/SheetActionsSection";
import { SheetConditionsSection } from "@/features/sheets/components/SheetConditionsSection";
import { SheetDetailDisclosure } from "@/features/sheets/components/SheetDetailDisclosure";
import { SheetEquipmentSection } from "@/features/sheets/components/SheetEquipmentSection";
import { SheetFormulaStatsEditor } from "@/features/sheets/components/SheetFormulaStatsEditor";
import { SheetAttributesSection } from "@/features/sheets/components/SheetAttributesSection";
import { SheetNotesSection } from "@/features/sheets/components/SheetNotesSection";
import { SheetProficienciesSection } from "@/features/sheets/components/SheetProficienciesSection";
import { SheetResourceHeader } from "@/features/sheets/components/SheetResourceHeader";
import { SheetResistancesEditor } from "@/features/sheets/components/SheetResistancesEditor";
import { SheetStatPointAllocator } from "@/features/sheets/components/SheetStatPointAllocator";
import { SheetStatsSection } from "@/features/sheets/components/SheetStatsSection";
import { SheetStandaloneEffectsSection } from "@/features/sheets/components/SheetStandaloneEffectsSection";
import { RollLog } from "@/features/rolls/RollLog";
import { SheetKillsSection } from "@/features/xp/SheetKillsSection";
import { SheetXpProgressBar } from "@/features/xp/SheetXpProgressBar";
import { useResourceEditor } from "@/features/sheets/hooks/useResourceEditor";
import { useSheetDetailState } from "@/features/sheets/hooks/useSheetDetailState";
import { useStatModifierEditor } from "@/features/sheets/hooks/useStatModifierEditor";
import { buildEquipmentQuantitySubmission } from "@/features/sheets/equipmentQuantity";
import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildAttachInstancedSheetActionRequest,
  buildAttachInstancedSheetAttributeRequest,
  buildAttachInstancedSheetItemRequest,
  buildCreateSheetFromInstanceRequest,
  buildDetachInstancedSheetActionRequest,
  buildDetachInstancedSheetAttributeRequest,
  buildDetachInstancedSheetItemRequest,
  buildGetActionFormulaAuthoringMetadataRequest,
  buildLinkInstancedSheetProficiencyRequest,
  buildPerformActionRequest,
  buildAllocateInstancedSheetStatPointsRequest,
  buildResetInstancedSheetAttributeValueRequest,
  buildRelinkInstancedSheetActionRequest,
  buildRemoveActiveConditionRequest,
  buildSetInstancedSheetNotesRequest,
  buildSetInstancedSheetItemEquippedRequest,
  buildSetInstancedSheetAttributeValueRequest,
  buildSetInstancedSheetFormulaStatRequest,
  buildSetInstancedSheetResistancesRequest,
  buildSetInstancedSheetUnassignedStatPointsRequest,
  buildUnlinkInstancedSheetProficiencyRequest,
  buildUpdateLinkedInstancedSheetProficiencyRequest
} from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
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
  const [snapshotSheetId, setSnapshotSheetId] = useState("");
  const [snapshotName, setSnapshotName] = useState("");
  const [unassignedStatPointsDraft, setUnassignedStatPointsDraft] = useState("0");
  const requestedFormulaMetadataRef = useRef(false);
  const activeTab = controlledActiveTab ?? localActiveTab;
  const setActiveTab = onActiveTabChange ?? setLocalActiveTab;
  const activeInstanceId = detail?.instance.id;
  const activeInstanceName = detail?.instance.name;

  const statEditor = useStatModifierEditor({
    resetToken: detail?.instance.id,
    instanceId: detail?.instance.id,
    baseStats: detail?.stats ?? {},
    client
  });

  const resourceEditor = useResourceEditor({
    resetToken: detail?.instance.id,
    instanceId: detail?.instance.id,
    baseHealth: detail?.resources.health ?? 0,
    baseMana: detail?.resources.mana ?? 0,
    client
  });
  const visibleResistances = detail?.persistentSheet.resistances ?? detail?.sheet?.resistances;

  useEffect(() => {
    if (!controlledActiveTab) {
      setLocalActiveTab("overview");
    }
  }, [controlledActiveTab, detail?.instance.id]);

  useEffect(() => {
    if (!activeInstanceId || !activeInstanceName) {
      setSnapshotSheetId("");
      setSnapshotName("");
      return;
    }
    setSnapshotSheetId(makeId("sheet_snapshot"));
    setSnapshotName(`${activeInstanceName} Snapshot`);
  }, [activeInstanceId, activeInstanceName]);

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

  useEffect(() => {
    setUnassignedStatPointsDraft(String(detail?.persistentSheet.unassigned_stat_points ?? 0));
  }, [detail?.instance.id, detail?.persistentSheet.unassigned_stat_points]);

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
  const showResistancesSection = activeTab === "resistances";
  const canEditStats = mode === "gm";
  const canEditActions = mode === "gm";
  const canManageEquipment = mode === "gm";
  const canEditProficiencies = mode === "gm";
  const canEditResistances = mode === "gm";
  const sheetId = detail.sheet?.id;
  const instanceAttributeBridges =
    detail.persistentSheet.attributes ?? detail.sheet?.attributes ?? {};
  const instanceFormulaStats = detail.persistentSheet.stats ?? detail.sheet?.stats ?? null;
  const unassignedStatPoints = detail.persistentSheet.unassigned_stat_points ?? 0;
  const parsedUnassignedStatPointsDraft = Number(unassignedStatPointsDraft);
  const canSaveUnassignedStatPoints =
    Number.isInteger(parsedUnassignedStatPointsDraft) && parsedUnassignedStatPointsDraft >= 0;

  const updateEquipmentBridgeEquipped = (relationshipId: string, equipped: boolean): void => {
    client.sendProtocolRequest(
      buildSetInstancedSheetItemEquippedRequest({
        instanceId: detail.instance.id,
        relationshipId,
        equipped
      }),
      equipped ? "Equip item" : "Unequip item"
    );
  };

  return (
    <Panel
      title={panelTitle ?? (mode === "gm" ? "Sheet Detail" : "Character Sheet")}
      className="sheet-panel"
    >
      <article className="character-sheet">
        <header className="character-sheet__header">
          <div className="character-sheet__identity-mark" aria-hidden="true">
            {sheetInitials(detail.instance.name)}
          </div>
          <div className="character-sheet__header-main">
            <h3>{detail.instance.name}</h3>
            <p>{mode === "gm" ? "Instanced sheet workspace" : "Active character sheet"}</p>
          </div>
          <div className="character-sheet__header-resources">
            <SheetResourceHeader
              maximums={detail.resourceMaximums}
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

        {mode === "player" && sheetId ? (
          <SheetXpProgressBar client={client} instanceId={detail.instance.id} sheetId={sheetId} />
        ) : null}

        {mode === "gm" ? (
          <section className="character-sheet__snapshot" aria-label="Snapshot as template">
            <div>
              <p className="template-editor__title">Snapshot as Template</p>
              <p className="muted">
                Save this instanced sheet as a new template checkpoint. Current health, mana, and
                active runtime effects are not copied.
              </p>
            </div>
            <div className="character-sheet__snapshot-fields">
              <Field label="Template ID">
                <input
                  value={snapshotSheetId}
                  onChange={(event) => setSnapshotSheetId(event.target.value)}
                  placeholder="sheet_snapshot_..."
                />
              </Field>
              <Field label="Template Name">
                <input
                  value={snapshotName}
                  onChange={(event) => setSnapshotName(event.target.value)}
                  placeholder="Checkpoint name"
                />
              </Field>
              <button
                type="button"
                className="button"
                disabled={!snapshotSheetId.trim() || !snapshotName.trim()}
                onClick={() => {
                  const nextId = snapshotSheetId.trim();
                  const nextName = snapshotName.trim();
                  if (!nextId || !nextName) {
                    return;
                  }
                  client.sendProtocolRequest(
                    buildCreateSheetFromInstanceRequest({
                      instanceId: detail.instance.id,
                      sheetId: nextId,
                      name: nextName
                    }),
                    `Snapshot template: ${nextName}`
                  );
                  setSnapshotSheetId(makeId("sheet_snapshot"));
                }}
              >
                Create Template Snapshot
              </button>
            </div>
          </section>
        ) : null}

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
                {mode === "gm" ? (
                  <section className="character-sheet__section character-sheet__section--compact">
                    <h4>Unassigned Stat Points</h4>
                    <div className="inline-actions">
                      <Field label="Current Pool">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={unassignedStatPointsDraft}
                          onChange={(event) => setUnassignedStatPointsDraft(event.target.value)}
                        />
                      </Field>
                      <button
                        type="button"
                        className="button"
                        disabled={!canSaveUnassignedStatPoints}
                        onClick={() => {
                          if (!canSaveUnassignedStatPoints) {
                            return;
                          }
                          client.sendProtocolRequest(
                            buildSetInstancedSheetUnassignedStatPointsRequest({
                              instanceId: detail.instance.id,
                              value: parsedUnassignedStatPointsDraft
                            }),
                            "Set unassigned stat points"
                          );
                        }}
                      >
                        Set Points
                      </button>
                    </div>
                  </section>
                ) : null}
                {mode === "player" ? (
                  <SheetStatPointAllocator
                    instanceId={detail.instance.id}
                    stats={detail.stats}
                    unassignedPoints={unassignedStatPoints}
                    onCommit={(allocations) =>
                      client.sendProtocolRequest(
                        buildAllocateInstancedSheetStatPointsRequest({
                          instanceId: detail.instance.id,
                          allocations
                        }),
                        "Allocate stat points"
                      )
                    }
                  />
                ) : null}
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
                  augmentations={augmentations}
                  mode={mode}
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
                client.sendProtocolRequest(
                  buildAttachInstancedSheetActionRequest({
                    instanceId: detail.instance.id,
                    bridge
                  }),
                  `Assign action: ${actionDefinitions[bridge.action_id]?.name ?? bridge.action_id}`
                );
              }}
              onUpdate={(relationshipId, bridge) => {
                client.sendProtocolRequest(
                  buildRelinkInstancedSheetActionRequest({
                    instanceId: detail.instance.id,
                    relationshipId,
                    bridge
                  }),
                  `Replace action: ${actionDefinitions[bridge.action_id]?.name ?? bridge.action_id}`
                );
              }}
              onDelete={(relationshipId) => {
                client.sendProtocolRequest(
                  buildDetachInstancedSheetActionRequest({
                    instanceId: detail.instance.id,
                    relationshipId
                  }),
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
            <SheetDetailDisclosure
              title="Attributes"
              count={Object.keys(instanceAttributeBridges).length}
            >
              <SheetAttributesSection
                definitions={attributeDefinitions}
                bridges={instanceAttributeBridges}
                canEdit={canEditStats}
                compact={mode === "player"}
                onSaveFormula={(attributeId, formula) => {
                  client.sendProtocolRequest(
                    buildSetInstancedSheetAttributeValueRequest({
                      instanceId: detail.instance.id,
                      attributeId,
                      value: { type: "formula", formula }
                    }),
                    `Update Attribute: ${attributeDefinitions[attributeId]?.name ?? attributeId}`
                  );
                }}
                onSaveValue={(attributeId, value) => {
                  client.sendProtocolRequest(
                    buildSetInstancedSheetAttributeValueRequest({
                      instanceId: detail.instance.id,
                      attributeId,
                      value
                    }),
                    `Update Attribute: ${attributeDefinitions[attributeId]?.name ?? attributeId}`
                  );
                }}
                onReset={(attributeId) => {
                  client.sendProtocolRequest(
                    buildResetInstancedSheetAttributeValueRequest({
                      instanceId: detail.instance.id,
                      attributeId
                    }),
                    `Reset Attribute: ${attributeDefinitions[attributeId]?.name ?? attributeId}`
                  );
                }}
                onAttach={(attributeId) => {
                  client.sendProtocolRequest(
                    buildAttachInstancedSheetAttributeRequest({
                      instanceId: detail.instance.id,
                      attributeId,
                      relationshipId: makeId("sheet_attribute")
                    }),
                    `Attach Attribute: ${attributeDefinitions[attributeId]?.name ?? attributeId}`
                  );
                }}
                onDetach={(attributeId) => {
                  client.sendProtocolRequest(
                    buildDetachInstancedSheetAttributeRequest({
                      instanceId: detail.instance.id,
                      attributeId
                    }),
                    `Detach Attribute: ${attributeDefinitions[attributeId]?.name ?? attributeId}`
                  );
                }}
              />
            </SheetDetailDisclosure>
            <SheetDetailDisclosure title="Proficiencies" count={sheetProficiencies.length}>
              <SheetProficienciesSection
                proficiencyDefinitions={proficiencyDefinitions}
                proficiencyOrder={proficiencyOrder}
                sheetProficiencies={sheetProficiencies}
                canEdit={canEditProficiencies}
                onCreate={(bridge) => {
                  client.sendProtocolRequest(
                    buildLinkInstancedSheetProficiencyRequest({
                      instanceId: detail.instance.id,
                      bridge
                    }),
                    `Assign proficiency: ${proficiencyDefinitions[bridge.prof_id]?.name ?? bridge.prof_id}`
                  );
                }}
                onUpdate={(relationshipId, bridge) => {
                  client.sendProtocolRequest(
                    buildUpdateLinkedInstancedSheetProficiencyRequest({
                      instanceId: detail.instance.id,
                      relationshipId,
                      bridge
                    }),
                    `Update proficiency: ${proficiencyDefinitions[bridge.prof_id]?.name ?? bridge.prof_id}`
                  );
                }}
                onDelete={(relationshipId) => {
                  client.sendProtocolRequest(
                    buildUnlinkInstancedSheetProficiencyRequest({
                      instanceId: detail.instance.id,
                      relationshipId
                    }),
                    "Remove proficiency"
                  );
                }}
              />
            </SheetDetailDisclosure>
            {sheetId ? (
              <SheetDetailDisclosure title="Tracked Kills">
                <SheetKillsSection
                  client={client}
                  instanceId={detail.instance.id}
                  sheetId={sheetId}
                />
              </SheetDetailDisclosure>
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
              proficiencyDefinitions={proficiencyDefinitions}
              augmentations={augmentations}
              itemOrder={itemOrder}
              selectedItemId={selectedItemId}
              selectedItem={selectedItem}
              equipment={equipment}
              canManageInventory={canManageEquipment}
              canToggleEquipped
              onSelectedItemIdChange={setSelectedItemId}
              onAddSelectedItem={() => {
                if (!selectedItem) {
                  return;
                }

                const relationshipId = makeId("item_bridge");
                client.sendProtocolRequest(
                  buildAttachInstancedSheetItemRequest({
                    instanceId: detail.instance.id,
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
                const bridge = equipment.find((entry) => entry.relationship_id === relationshipId);
                const item = bridge ? items[bridge.item_id] : undefined;
                if (!bridge || !item) {
                  return;
                }
                const submission = buildEquipmentQuantitySubmission({
                  instanceId: detail.instance.id,
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
                client.sendProtocolRequest(
                  buildDetachInstancedSheetItemRequest({
                    instanceId: detail.instance.id,
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
            <RollLog sheetId={detail.sheet?.id} instanceId={detail.instance.id} />
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
            {canEditStats && instanceFormulaStats ? (
              <SheetFormulaStatsEditor
                stats={instanceFormulaStats}
                metadata={actionFormulaAuthoringMetadata}
                onSave={(statName, formula) =>
                  client.sendProtocolRequest(
                    buildSetInstancedSheetFormulaStatRequest({
                      instanceId: detail.instance.id,
                      statName,
                      formula
                    }),
                    `Update formula stat: ${statName}`
                  )
                }
              />
            ) : (
              <EmptyState message="No formula stats available for this instance." />
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
            {visibleResistances ? (
              <SheetResistancesEditor
                resistances={visibleResistances}
                readOnly={!canEditResistances}
                title={canEditResistances ? "Instance Resistances" : "Current Resistances"}
                onSave={(resistances) =>
                  client.sendProtocolRequest(
                    buildSetInstancedSheetResistancesRequest({
                      instanceId: detail.instance.id,
                      resistances
                    }),
                    "Update instance resistances"
                  )
                }
              />
            ) : (
              <EmptyState message="No character resistances available." />
            )}
          </div>
        ) : null}
      </article>
    </Panel>
  );
}
