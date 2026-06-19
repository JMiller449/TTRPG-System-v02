import { useEffect, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import {
  selectActiveSheetDetail,
  selectActiveWeaponEntryId,
  selectActiveWeaponLabel,
  selectAvailableItems,
  selectSheetAssignedActions,
  selectSheetEquipment
} from "@/app/state/selectors";
import type { AssignedSheetAction } from "@/app/state/selectors";
import type { ItemBridge, ItemDefinition } from "@/domain/models";

interface UseSheetDetailStateResult {
  detail: ReturnType<typeof selectActiveSheetDetail>;
  items: Record<string, ItemDefinition>;
  itemOrder: string[];
  runtimeNote: string;
  equipment: ItemBridge[];
  assignedActions: AssignedSheetAction[];
  activeWeaponId: string | null;
  activeWeaponLabel: string;
  selectedItemId: string;
  selectedItem: ItemDefinition | null;
  setSelectedItemId: (itemId: string) => void;
}

export function useSheetDetailState(): UseSheetDetailStateResult {
  const { state } = useAppStore();
  const { localSheetNotes } = state.uiState;
  const { items, itemOrder } = state.serverState;

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
      items,
      itemOrder,
      runtimeNote: "",
      equipment: [],
      assignedActions: [],
      activeWeaponId: null,
      activeWeaponLabel: "None",
      selectedItemId,
      selectedItem: null,
      setSelectedItemId
    };
  }

  return {
    detail,
    items,
    itemOrder,
    runtimeNote: localSheetNotes[detail.instance.id] ?? detail.instance.notes ?? "",
    equipment: selectSheetEquipment(state, detail.sheet?.id ?? detail.instance.id),
    assignedActions: selectSheetAssignedActions(state, detail.sheet?.id ?? detail.instance.id),
    activeWeaponId: selectActiveWeaponEntryId(state, detail.sheet?.id ?? detail.instance.id),
    activeWeaponLabel: selectActiveWeaponLabel(state, detail.sheet?.id ?? detail.instance.id),
    selectedItemId,
    selectedItem:
      selectedItemId ? availableItems.find((item) => item.id === selectedItemId) ?? null : null,
    setSelectedItemId
  };
}
