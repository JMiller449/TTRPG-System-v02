import { useEffect, useState } from "react";
import { useAppStore } from "@/app/state/store";
import {
  selectActiveSheetDetail,
  selectActiveWeaponEntryId,
  selectActiveWeaponLabel,
  selectAvailableItems,
  selectSheetEquipment
} from "@/app/state/selectors";
import type { ItemDefinition, SheetInventoryItem } from "@/domain/models";

interface UseSheetDetailStateResult {
  detail: ReturnType<typeof selectActiveSheetDetail>;
  items: Record<string, ItemDefinition>;
  itemOrder: string[];
  runtimeNote: string;
  equipment: SheetInventoryItem[];
  activeWeaponId: string | null;
  activeWeaponLabel: string;
  selectedItemTemplateId: string;
  selectedItem: ItemDefinition | null;
  setSelectedItemTemplateId: (itemTemplateId: string) => void;
}

export function useSheetDetailState(): UseSheetDetailStateResult {
  const { state } = useAppStore();
  const { localSheetNotes } = state.uiState;
  const { items, itemOrder } = state.serverState;

  const detail = selectActiveSheetDetail(state);
  const availableItems = selectAvailableItems(state);

  const [selectedItemTemplateId, setSelectedItemTemplateId] = useState<string>(itemOrder[0] || "");

  useEffect(() => {
    setSelectedItemTemplateId((prev) => {
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
      activeWeaponId: null,
      activeWeaponLabel: "None",
      selectedItemTemplateId,
      selectedItem: null,
      setSelectedItemTemplateId
    };
  }

  return {
    detail,
    items,
    itemOrder,
    runtimeNote: localSheetNotes[detail.instance.id] ?? detail.instance.notes ?? "",
    equipment: selectSheetEquipment(state, detail.instance.id),
    activeWeaponId: selectActiveWeaponEntryId(state, detail.instance.id),
    activeWeaponLabel: selectActiveWeaponLabel(state, detail.instance.id),
    selectedItemTemplateId,
    selectedItem:
      selectedItemTemplateId ? availableItems.find((item) => item.id === selectedItemTemplateId) ?? null : null,
    setSelectedItemTemplateId
  };
}
