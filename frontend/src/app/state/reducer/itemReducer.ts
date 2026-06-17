import type { AppAction, AppState } from "@/app/state/types";
import { updateUiState } from "@/app/state/reducer/shared";

export function itemReducer(state: AppState, action: AppAction): AppState | undefined {
  switch (action.type) {
    case "upsert_item_template": {
      const exists = state.uiState.itemTemplateOrder.includes(action.item.id);
      return updateUiState(state, (uiState) => ({
        ...uiState,
        itemTemplates: {
          ...uiState.itemTemplates,
          [action.item.id]: action.item
        },
        itemTemplateOrder: exists ? uiState.itemTemplateOrder : [...uiState.itemTemplateOrder, action.item.id]
      }));
    }

    case "remove_item_template": {
      const nextTemplates = { ...state.uiState.itemTemplates };
      delete nextTemplates[action.itemId];

      return updateUiState(state, (uiState) => ({
        ...uiState,
        itemTemplates: nextTemplates,
        itemTemplateOrder: uiState.itemTemplateOrder.filter((id) => id !== action.itemId)
      }));
    }

    default:
      return undefined;
  }
}
