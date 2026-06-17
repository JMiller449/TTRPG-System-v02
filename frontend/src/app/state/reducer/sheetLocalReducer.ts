import type { AppAction, AppState } from "@/app/state/types";
import { updateUiState } from "@/app/state/reducer/shared";

export function sheetLocalReducer(state: AppState, action: AppAction): AppState | undefined {
  switch (action.type) {
    case "set_sheet_note":
      return updateUiState(state, (uiState) => ({
        ...uiState,
        localSheetNotes: {
          ...uiState.localSheetNotes,
          [action.sheetId]: action.note
        }
      }));

    case "set_sheet_stat_overrides": {
      const sanitized = Object.fromEntries(
        Object.entries(action.overrides).filter((entry) => Number.isFinite(entry[1]))
      );
      return updateUiState(state, (uiState) => ({
        ...uiState,
        localSheetStatOverrides: {
          ...uiState.localSheetStatOverrides,
          [action.sheetId]: sanitized
        }
      }));
    }

    case "clear_sheet_stat_overrides": {
      const next = { ...state.uiState.localSheetStatOverrides };
      delete next[action.sheetId];
      return updateUiState(state, (uiState) => ({
        ...uiState,
        localSheetStatOverrides: next
      }));
    }

    default:
      return undefined;
  }
}
