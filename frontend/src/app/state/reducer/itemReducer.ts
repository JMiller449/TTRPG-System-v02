import type { AppAction, AppState } from "@/app/state/types";

export function itemReducer(state: AppState, action: AppAction): AppState | undefined {
  switch (action.type) {
    case "upsert_item_template": {
      const exists = state.itemTemplateOrder.includes(action.item.id);
      return {
        ...state,
        itemTemplates: {
          ...state.itemTemplates,
          [action.item.id]: action.item
        },
        itemTemplateOrder: exists ? state.itemTemplateOrder : [...state.itemTemplateOrder, action.item.id]
      };
    }

    case "remove_item_template": {
      const nextTemplates = { ...state.itemTemplates };
      delete nextTemplates[action.itemId];

      const nextEquipment = Object.fromEntries(
        Object.entries(state.localSheetEquipment).map(([sheetId, entries]) => [
          sheetId,
          entries.filter((entry) => entry.itemTemplateId !== action.itemId)
        ])
      );

      const nextActiveWeapon = Object.fromEntries(
        Object.entries(state.localSheetActiveWeapon).map(([sheetId, activeInventoryId]) => {
          if (!activeInventoryId) {
            return [sheetId, null];
          }

          const stillExists = (nextEquipment[sheetId] ?? []).some((entry) => entry.id === activeInventoryId);
          return [sheetId, stillExists ? activeInventoryId : null];
        })
      );

      return {
        ...state,
        itemTemplates: nextTemplates,
        itemTemplateOrder: state.itemTemplateOrder.filter((id) => id !== action.itemId),
        localSheetEquipment: nextEquipment,
        localSheetActiveWeapon: nextActiveWeapon
      };
    }

    default:
      return undefined;
  }
}
