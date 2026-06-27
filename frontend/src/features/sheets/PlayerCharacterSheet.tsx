import { useEffect, useState } from "react";
import { CharacterSheetTabs } from "@/features/sheets/components/CharacterSheetTabs";
import { SheetActionsSection } from "@/features/sheets/components/SheetActionsSection";
import { SheetEquipmentSection } from "@/features/sheets/components/SheetEquipmentSection";
import { SheetNotesSection } from "@/features/sheets/components/SheetNotesSection";
import { SheetProficienciesSection } from "@/features/sheets/components/SheetProficienciesSection";
import { SheetResourceHeader } from "@/features/sheets/components/SheetResourceHeader";
import { SheetStatsSection } from "@/features/sheets/components/SheetStatsSection";
import { SheetKillsSection } from "@/features/xp/SheetKillsSection";
import { useResourceEditor } from "@/features/sheets/hooks/useResourceEditor";
import { useSheetDetailState } from "@/features/sheets/hooks/useSheetDetailState";
import { useStatModifierEditor } from "@/features/sheets/hooks/useStatModifierEditor";
import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildCreateSheetItemBridgeRequest,
  buildCreateSheetProficiencyBridgeRequest,
  buildDeleteSheetItemBridgeRequest,
  buildDeleteSheetProficiencyBridgeRequest,
  buildPerformActionRequest,
  buildSetInstancedSheetNotesRequest,
  buildUpdateSheetItemBridgeRequest,
  buildUpdateSheetProficiencyBridgeRequest
} from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

export function PlayerCharacterSheet({
  mode = "player",
  panelTitle,
  client
}: {
  mode?: "player" | "gm";
  panelTitle?: string;
  client: GameClient;
}): JSX.Element {
  const {
    detail,
    items,
    itemOrder,
    proficiencyDefinitions,
    proficiencyOrder,
    runtimeNote,
    equipment,
    sheetProficiencies,
    assignedActions,
    activeWeaponId,
    activeWeaponLabel,
    selectedItemId,
    selectedItem,
    setSelectedItemId
  } = useSheetDetailState();

  const [activeTab, setActiveTab] = useState<PlayerSheetTab>("stats");

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
    setActiveTab("stats");
  }, [detail?.instance.id]);

  const formattedUpdatedAt =
    detail && detail.instance.updatedAt
      ? (() => {
          const parsed = new Date(detail.instance.updatedAt);
          return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString();
        })()
      : null;

  if (!detail) {
    return (
      <Panel title="Character Sheet">
        <EmptyState message="No active sheet selected." />
      </Panel>
    );
  }

  const showStatsSection = activeTab === "stats";
  const showActionsSection = activeTab === "actions";
  const showEquipmentSection = activeTab === "equipment";
  const showProficienciesSection = activeTab === "proficiencies";
  const showKillsSection = activeTab === "kills";
  const showNotesSection = activeTab === "notes";
  const canEditStats = mode === "gm";
  const canEditEquipment = mode === "gm";
  const canEditProficiencies = mode === "gm";
  const sheetId = detail.sheet?.id;

  const updateEquipmentBridgeActive = (relationshipId: string, active: boolean): void => {
    if (!sheetId) {
      return;
    }

    const bridge = equipment.find((entry) => entry.relationship_id === relationshipId);
    if (!bridge) {
      return;
    }

    client.sendProtocolRequest(
      buildUpdateSheetItemBridgeRequest({
        sheetId,
        relationshipId,
        bridge: {
          ...bridge,
          active
        }
      }),
      active ? "Set active equipment" : "Clear active equipment"
    );
  };

  return (
    <Panel title={panelTitle ?? (mode === "gm" ? "Sheet Detail" : "Character Sheet")}>
      <p className="character-sheet__panel-subtext muted">
        Sheet ID: {detail.instance.id}
        {formattedUpdatedAt ? ` · Updated: ${formattedUpdatedAt}` : ""}
      </p>
      <article className="character-sheet">
        <header className="character-sheet__header">
          <div className="character-sheet__header-main">
            <h3>{detail.instance.name}</h3>
          </div>
          <div className="character-sheet__header-right">
            <SheetResourceHeader
              mode={mode}
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

        <CharacterSheetTabs activeTab={activeTab} onChange={setActiveTab} />

        {showStatsSection ? (
          <SheetStatsSection
            canEditStats={canEditStats}
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
        ) : null}

        {showActionsSection ? (
          <SheetActionsSection
            assignedActions={assignedActions}
            onPerformAction={(action, rollMode) => {
              client.sendProtocolRequest(
                buildPerformActionRequest({
                  sheetId: detail.instance.id,
                  actionId: action.actionId,
                  rollMode
                }),
                `Perform action: ${action.action.name}`
              );
            }}
          />
        ) : null}

        {showNotesSection ? (
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
        ) : null}

        {showKillsSection && sheetId ? (
          <SheetKillsSection
            client={client}
            instanceId={detail.instance.id}
            sheetId={sheetId}
          />
        ) : null}

        {showProficienciesSection ? (
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
                buildCreateSheetProficiencyBridgeRequest({
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
                buildUpdateSheetProficiencyBridgeRequest({
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
                buildDeleteSheetProficiencyBridgeRequest({
                  sheetId,
                  relationshipId
                }),
                "Remove proficiency"
              );
            }}
          />
        ) : null}

        {showEquipmentSection ? (
          <SheetEquipmentSection
            items={items}
            itemOrder={itemOrder}
            selectedItemId={selectedItemId}
            selectedItem={selectedItem}
            activeWeaponLabel={activeWeaponLabel}
            equipment={equipment}
            activeWeaponId={activeWeaponId}
            canEdit={canEditEquipment}
            onSelectedItemIdChange={setSelectedItemId}
            onAddSelectedItem={() => {
              if (!sheetId || !selectedItem) {
                return;
              }

              const relationshipId = makeId("item_bridge");
              client.sendProtocolRequest(
                buildCreateSheetItemBridgeRequest({
                  sheetId,
                  bridge: {
                    relationship_id: relationshipId,
                    item_id: selectedItem.id,
                    count: 1,
                    active: !activeWeaponId
                  }
                }),
                "Add equipment"
              );
            }}
            onToggleActiveWeapon={(relationshipId) => {
              if (activeWeaponId === relationshipId) {
                updateEquipmentBridgeActive(relationshipId, false);
                return;
              }

              if (activeWeaponId) {
                updateEquipmentBridgeActive(activeWeaponId, false);
              }
              updateEquipmentBridgeActive(relationshipId, true);
            }}
            onRemoveInventoryItem={(relationshipId) => {
              if (!sheetId) {
                return;
              }
              client.sendProtocolRequest(
                buildDeleteSheetItemBridgeRequest({
                  sheetId,
                  relationshipId
                }),
                "Remove equipment"
              );
            }}
          />
        ) : null}
      </article>
    </Panel>
  );
}
