import { useEffect, useState } from "react";
import { useAppStore } from "@/app/state/store";
import { CharacterSheetTabs } from "@/features/sheets/components/CharacterSheetTabs";
import { SheetEquipmentSection } from "@/features/sheets/components/SheetEquipmentSection";
import { SheetNotesSection } from "@/features/sheets/components/SheetNotesSection";
import { SheetResourceHeader } from "@/features/sheets/components/SheetResourceHeader";
import { SheetStatsSection } from "@/features/sheets/components/SheetStatsSection";
import { useResourceEditor } from "@/features/sheets/hooks/useResourceEditor";
import { useSheetDetailState } from "@/features/sheets/hooks/useSheetDetailState";
import { useStatModifierEditor } from "@/features/sheets/hooks/useStatModifierEditor";
import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

export function PlayerCharacterSheet({
  mode = "player",
  panelTitle
}: {
  mode?: "player" | "gm";
  panelTitle?: string;
}): JSX.Element {
  const { dispatch } = useAppStore();
  const {
    detail,
    itemTemplates,
    itemTemplateOrder,
    runtimeNote,
    equipment,
    activeWeaponId,
    activeWeaponLabel,
    selectedItemTemplateId,
    selectedTemplate,
    setSelectedItemTemplateId
  } = useSheetDetailState();

  const [activeTab, setActiveTab] = useState<PlayerSheetTab>("stats");

  const statEditor = useStatModifierEditor({
    resetToken: detail?.instance.id
  });

  const resourceEditor = useResourceEditor({
    resetToken: detail?.instance.id,
    baseHealth: detail?.stats.health ?? 0,
    baseMana: detail?.stats.mana ?? 0
  });

  useEffect(() => {
    setActiveTab("stats");
  }, [detail?.instance.id]);

  if (!detail) {
    return (
      <Panel title="Character Sheet">
        <EmptyState message="No active sheet selected." />
      </Panel>
    );
  }

  const showStatsSection = mode !== "player" || activeTab === "stats";
  const showEquipmentSection = mode !== "player" || activeTab === "equipment";
  const showNotesSection = mode !== "player" || activeTab === "notes";
  const canEditStats = mode === "gm";

  return (
    <Panel title={panelTitle ?? (mode === "gm" ? "Sheet Detail" : "Character Sheet")}>
      <p className="character-sheet__panel-subtext muted">
        Sheet ID: {detail.instance.id} · Updated: {new Date(detail.instance.updatedAt).toLocaleDateString()}
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

        {mode === "player" ? <CharacterSheetTabs activeTab={activeTab} onChange={setActiveTab} /> : null}

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

        {showNotesSection ? (
          <SheetNotesSection
            note={runtimeNote}
            onChange={(note) =>
              dispatch({
                type: "set_sheet_note",
                sheetId: detail.instance.id,
                note
              })
            }
          />
        ) : null}

        {showEquipmentSection ? (
          <SheetEquipmentSection
            itemTemplates={itemTemplates}
            itemTemplateOrder={itemTemplateOrder}
            selectedItemTemplateId={selectedItemTemplateId}
            selectedTemplate={selectedTemplate}
            activeWeaponLabel={activeWeaponLabel}
            equipment={equipment}
            activeWeaponId={activeWeaponId}
            onSelectedItemTemplateIdChange={setSelectedItemTemplateId}
            onAddSelectedTemplate={() => {
              if (!selectedTemplate) {
                return;
              }

              const nextEntry = {
                id: makeId("inv"),
                itemTemplateId: selectedTemplate.id
              };

              dispatch({ type: "add_sheet_equipment", sheetId: detail.instance.id, entry: nextEntry });

              if (!activeWeaponId) {
                dispatch({
                  type: "set_sheet_active_weapon",
                  sheetId: detail.instance.id,
                  inventoryItemId: nextEntry.id
                });
              }
            }}
            onToggleActiveWeapon={(inventoryItemId) =>
              dispatch({
                type: "set_sheet_active_weapon",
                sheetId: detail.instance.id,
                inventoryItemId: activeWeaponId === inventoryItemId ? null : inventoryItemId
              })
            }
            onRemoveInventoryItem={(inventoryItemId) =>
              dispatch({
                type: "remove_sheet_equipment",
                sheetId: detail.instance.id,
                inventoryItemId
              })
            }
          />
        ) : null}
      </article>
    </Panel>
  );
}
