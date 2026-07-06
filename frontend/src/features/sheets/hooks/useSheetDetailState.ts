import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import {
  selectActiveSheetDetail,
  selectActiveConditions,
  selectActiveStandaloneEffects,
  selectSheetAssignedActions,
  selectSheetEquipment,
  selectSheetProficiencies
} from "@/app/state/selectors";
import type { AssignedSheetAction } from "@/app/state/selectors";
import type { ActiveStandaloneEffect } from "@/app/state/selectors";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { AppState } from "@/app/state/types";
import type {
  ActionDefinition,
  ActiveCondition,
  Augmentation,
  AttributeDefinition,
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
  attributeDefinitions: Record<string, AttributeDefinition>;
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
  const { serverState } = state;
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
    attributes: attributeDefinitions
  } = serverState;
  const { activeSheetId, actionFormulaAuthoringMetadata } = state.uiState;
  const selectorState = useMemo(
    () =>
      ({
        serverState,
        uiState: { activeSheetId }
      }) as AppState,
    [activeSheetId, serverState]
  );

  const detail = useMemo(() => selectActiveSheetDetail(selectorState), [selectorState]);
  const sheetOrInstanceId = detail?.sheet?.id ?? detail?.instance.id ?? null;
  const instanceId = detail?.instance.id ?? null;
  const equipment = useMemo(
    () => (instanceId ? selectSheetEquipment(selectorState, instanceId) : []),
    [instanceId, selectorState]
  );
  const sheetProficiencies = useMemo(
    () => (sheetOrInstanceId ? selectSheetProficiencies(selectorState, sheetOrInstanceId) : []),
    [selectorState, sheetOrInstanceId]
  );
  const assignedActions = useMemo(
    () => (instanceId ? selectSheetAssignedActions(selectorState, instanceId) : []),
    [instanceId, selectorState]
  );
  const activeConditions = useMemo(
    () => (detail ? selectActiveConditions(selectorState, detail.instance.id) : []),
    [detail, selectorState]
  );
  const activeStandaloneEffects = useMemo(
    () => (detail ? selectActiveStandaloneEffects(selectorState, detail.instance.id) : []),
    [detail, selectorState]
  );

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
      attributeDefinitions,
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
    attributeDefinitions,
    actionFormulaAuthoringMetadata,
    items,
    itemOrder,
    proficiencyDefinitions,
    proficiencyOrder,
    runtimeNote: detail.instance.notes ?? "",
    equipment,
    sheetProficiencies,
    assignedActions,
    activeConditions,
    activeStandaloneEffects,
    selectedItemId,
    selectedItem: selectedItemId ? (items[selectedItemId] ?? null) : null,
    setSelectedItemId
  };
}
