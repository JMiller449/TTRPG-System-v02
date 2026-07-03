import { useEffect, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import {
  selectActiveSheetDetail,
  selectActiveConditions,
  selectActiveStandaloneEffects,
  selectAvailableItems,
  selectSheetAssignedActions,
  selectSheetEquipment,
  selectSheetProficiencies
} from "@/app/state/selectors";
import type { AssignedSheetAction } from "@/app/state/selectors";
import type { ActiveStandaloneEffect } from "@/app/state/selectors";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type {
  ActionDefinition,
  ActiveCondition,
  Augmentation,
  FactDefinition,
  ItemBridge,
  ItemDefinition,
  ProficiencyBridge,
  ProficiencyDefinition,
  Sheet
} from "@/domain/models";

interface UseSheetDetailStateResult {
  detail: ReturnType<typeof selectActiveSheetDetail>;
  sheets: Record<string, Sheet>;
  sheetOrder: string[];
  actionDefinitions: Record<string, ActionDefinition>;
  actionOrder: string[];
  augmentations: Record<string, Augmentation>;
  factDefinitions: Record<string, FactDefinition>;
  actionFormulaAuthoringMetadata: ActionFormulaAuthoringMetadata | null;
  items: Record<string, ItemDefinition>;
  itemOrder: string[];
  proficiencyDefinitions: Record<string, ProficiencyDefinition>;
  proficiencyOrder: string[];
  runtimeNote: string;
  equipment: ItemBridge[];
  sheetProficiencies: ProficiencyBridge[];
  assignedActions: AssignedSheetAction[];
  activeConditions: ActiveCondition[];
  activeStandaloneEffects: ActiveStandaloneEffect[];
  selectedItemId: string;
  selectedItem: ItemDefinition | null;
  setSelectedItemId: (itemId: string) => void;
}

export function useSheetDetailState(): UseSheetDetailStateResult {
  const { state } = useAppStore();
  const {
    items,
    itemOrder,
    proficiencies: proficiencyDefinitions,
    proficiencyOrder,
    sheets,
    sheetOrder,
    actions: actionDefinitions,
    actionOrder,
    augmentations,
    facts: factDefinitions
  } = state.serverState;
  const { actionFormulaAuthoringMetadata } = state.uiState;

  const detail = selectActiveSheetDetail(state);
  const availableItems = selectAvailableItems(state);

  const [selectedItemId, setSelectedItemId] = useState<string>(itemOrder[0] || "");

  useEffect(() => {
    setSelectedItemId((prev) => {
      if (prev && items[prev]) {
        return prev;
      }
      return itemOrder[0] || "";
    });
  }, [detail?.instance.id, items, itemOrder]);

  if (!detail) {
    return {
      detail: null,
      sheets,
      sheetOrder,
      actionDefinitions,
      actionOrder,
      augmentations,
      factDefinitions,
      actionFormulaAuthoringMetadata,
      items,
      itemOrder,
      proficiencyDefinitions,
      proficiencyOrder,
      runtimeNote: "",
      equipment: [],
      sheetProficiencies: [],
      assignedActions: [],
      activeConditions: [],
      activeStandaloneEffects: [],
      selectedItemId,
      selectedItem: null,
      setSelectedItemId
    };
  }

  return {
    detail,
    sheets,
    sheetOrder,
    actionDefinitions,
    actionOrder,
    augmentations,
    factDefinitions,
    actionFormulaAuthoringMetadata,
    items,
    itemOrder,
    proficiencyDefinitions,
    proficiencyOrder,
    runtimeNote: detail.instance.notes ?? "",
    equipment: selectSheetEquipment(state, detail.sheet?.id ?? detail.instance.id),
    sheetProficiencies: selectSheetProficiencies(state, detail.sheet?.id ?? detail.instance.id),
    assignedActions: selectSheetAssignedActions(state, detail.sheet?.id ?? detail.instance.id),
    activeConditions: selectActiveConditions(state, detail.instance.id),
    activeStandaloneEffects: selectActiveStandaloneEffects(state, detail.instance.id),
    selectedItemId,
    selectedItem: selectedItemId
      ? (availableItems.find((item) => item.id === selectedItemId) ?? null)
      : null,
    setSelectedItemId
  };
}
