import type { AppAction, AppState } from "@/app/state/types";

export function sheetLocalReducer(state: AppState, action: AppAction): AppState | undefined {
  switch (action.type) {
    case "set_sheet_note":
      return {
        ...state,
        localSheetNotes: {
          ...state.localSheetNotes,
          [action.sheetId]: action.note
        }
      };

    case "add_sheet_equipment": {
      const current = state.localSheetEquipment[action.sheetId] ?? [];
      return {
        ...state,
        localSheetEquipment: {
          ...state.localSheetEquipment,
          [action.sheetId]: [...current, action.entry]
        }
      };
    }

    case "remove_sheet_equipment": {
      const current = state.localSheetEquipment[action.sheetId] ?? [];
      const nextItems = current.filter((entry) => entry.id !== action.inventoryItemId);
      const currentActive = state.localSheetActiveWeapon[action.sheetId] ?? null;
      return {
        ...state,
        localSheetEquipment: {
          ...state.localSheetEquipment,
          [action.sheetId]: nextItems
        },
        localSheetActiveWeapon: {
          ...state.localSheetActiveWeapon,
          [action.sheetId]: currentActive === action.inventoryItemId ? null : currentActive
        }
      };
    }

    case "set_sheet_active_weapon":
      return {
        ...state,
        localSheetActiveWeapon: {
          ...state.localSheetActiveWeapon,
          [action.sheetId]: action.inventoryItemId
        }
      };

    case "set_sheet_stat_overrides": {
      const sanitized = Object.fromEntries(
        Object.entries(action.overrides).filter((entry) => Number.isFinite(entry[1]))
      );
      return {
        ...state,
        localSheetStatOverrides: {
          ...state.localSheetStatOverrides,
          [action.sheetId]: sanitized
        }
      };
    }

    case "clear_sheet_stat_overrides": {
      const next = { ...state.localSheetStatOverrides };
      delete next[action.sheetId];
      return {
        ...state,
        localSheetStatOverrides: next
      };
    }

    default:
      return undefined;
  }
}
