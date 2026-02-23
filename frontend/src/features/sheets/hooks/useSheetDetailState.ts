import { useEffect, useState } from "react";
import { useAppStore } from "@/app/state/store";
import {
  selectActiveSheetDetail,
  selectActiveWeaponEntryId,
  selectActiveWeaponLabel,
  selectSheetEquipment
} from "@/app/state/selectors";
import type { ItemTemplate, SheetInventoryItem } from "@/domain/models";

interface UseSheetDetailStateResult {
  detail: ReturnType<typeof selectActiveSheetDetail>;
  itemTemplates: Record<string, ItemTemplate>;
  itemTemplateOrder: string[];
  runtimeNote: string;
  equipment: SheetInventoryItem[];
  activeWeaponId: string | null;
  activeWeaponLabel: string;
  selectedItemTemplateId: string;
  selectedTemplate: ItemTemplate | null;
  setSelectedItemTemplateId: (itemTemplateId: string) => void;
}

export function useSheetDetailState(): UseSheetDetailStateResult {
  const { state } = useAppStore();
  const { itemTemplates, itemTemplateOrder, localSheetNotes } = state;

  const detail = selectActiveSheetDetail(state);

  const [selectedItemTemplateId, setSelectedItemTemplateId] = useState<string>(itemTemplateOrder[0] || "");

  useEffect(() => {
    setSelectedItemTemplateId((prev) => {
      if (prev && itemTemplates[prev]) {
        return prev;
      }
      return itemTemplateOrder[0] || "";
    });
  }, [detail?.instance.id, itemTemplates, itemTemplateOrder]);

  if (!detail) {
    return {
      detail: null,
      itemTemplates,
      itemTemplateOrder,
      runtimeNote: "",
      equipment: [],
      activeWeaponId: null,
      activeWeaponLabel: "None",
      selectedItemTemplateId,
      selectedTemplate: null,
      setSelectedItemTemplateId
    };
  }

  return {
    detail,
    itemTemplates,
    itemTemplateOrder,
    runtimeNote: localSheetNotes[detail.instance.id] ?? detail.instance.notes ?? "",
    equipment: selectSheetEquipment(state, detail.instance.id),
    activeWeaponId: selectActiveWeaponEntryId(state, detail.instance.id),
    activeWeaponLabel: selectActiveWeaponLabel(state, detail.instance.id),
    selectedItemTemplateId,
    selectedTemplate: selectedItemTemplateId ? itemTemplates[selectedItemTemplateId] ?? null : null,
    setSelectedItemTemplateId
  };
}
