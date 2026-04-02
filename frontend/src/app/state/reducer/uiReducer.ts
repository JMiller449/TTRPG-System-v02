import type { AppAction, AppState } from "@/app/state/types";
import { initialUiState } from "@/app/state/initialState";
import { updateServerState, updateUiState } from "@/app/state/reducer/shared";

export function uiReducer(state: AppState, action: AppAction): AppState | undefined {
  switch (action.type) {
    case "set_role":
      return {
        ...state,
        serverState: {
          ...state.serverState,
          role: action.role
        },
        uiState: {
          ...state.uiState,
          playerSheetSelectionComplete: false,
          gmView: action.role === "gm" ? state.uiState.gmView : "console",
          activeSheetId: null
        }
      };
    case "set_player_sheet_selection_complete":
      return updateUiState(state, (uiState) => ({ ...uiState, playerSheetSelectionComplete: action.value }));
    case "set_gm_authenticated":
      return updateServerState(state, (serverState) => ({ ...serverState, gmAuthenticated: action.value }));
    case "set_gm_view":
      return updateUiState(state, (uiState) => ({ ...uiState, gmView: action.view }));
    case "set_active_sheet_local":
      return updateUiState(state, (uiState) => ({ ...uiState, activeSheetId: action.sheetId }));
    case "set_template_search":
      return updateUiState(state, (uiState) => ({ ...uiState, templateSearch: action.value }));
    case "reset_session_ui":
      return updateUiState(state, (uiState) => ({
        ...uiState,
        playerSheetSelectionComplete: initialUiState.playerSheetSelectionComplete,
        gmView: initialUiState.gmView,
        activeSheetId: initialUiState.activeSheetId,
        templateSearch: initialUiState.templateSearch,
        pendingIntentIds: initialUiState.pendingIntentIds,
        intentFeedback: initialUiState.intentFeedback,
        localSheetNotes: initialUiState.localSheetNotes,
        localSheetEquipment: initialUiState.localSheetEquipment,
        localSheetActiveWeapon: initialUiState.localSheetActiveWeapon,
        localSheetStatOverrides: initialUiState.localSheetStatOverrides
      }));
    default:
      return undefined;
  }
}
