import type { AppAction, AppState, ServerState } from "@/app/state/types";
import { updateServerState, updateUiState } from "@/app/state/reducer/shared";

function normalizeUiSelections(state: AppState): AppState {
  const { activeSheetId } = state.uiState;
  if (!activeSheetId) {
    return state;
  }

  if (state.serverState.persistentSheets[activeSheetId]) {
    return state;
  }

  return updateUiState(state, (uiState) => ({
    ...uiState,
    activeSheetId: null,
    playerSheetSelectionComplete: false
  }));
}

export function syncReducer(state: AppState, action: AppAction): AppState | undefined {
  switch (action.type) {
    case "apply_snapshot": {
      const sheets = Object.fromEntries(action.snapshot.sheets.map((item) => [item.id, item]));
      const persistentSheets = Object.fromEntries(
        action.snapshot.persistentSheets.map((item) => [item.id, item.value])
      );
      const items = Object.fromEntries(action.snapshot.items.map((item) => [item.id, item]));
      const actions = Object.fromEntries(action.snapshot.actions.map((item) => [item.id, item]));
      const formulas = Object.fromEntries(action.snapshot.formulas.map((item) => [item.id, item]));
      const sheetPresentation = Object.fromEntries(
        action.snapshot.sheetPresentation.map((item) => [item.sheetId, item.value])
      );
      const persistentSheetPresentation = Object.fromEntries(
        action.snapshot.persistentSheetPresentation.map((item) => [item.persistentSheetId, item.value])
      );
      const encounters = Object.fromEntries(action.snapshot.encounters.map((item) => [item.id, item]));
      return normalizeUiSelections(
        updateServerState(state, (serverState) => ({
          ...serverState,
          sheets,
          sheetOrder: action.snapshot.sheets.map((item) => item.id),
          persistentSheets,
          persistentSheetOrder: action.snapshot.persistentSheets.map((item) => item.id),
          items,
          itemOrder: action.snapshot.items.map((item) => item.id),
          actions,
          actionOrder: action.snapshot.actions.map((item) => item.id),
          formulas,
          formulaOrder: action.snapshot.formulas.map((item) => item.id),
          sheetPresentation,
          persistentSheetPresentation,
          encounters,
          encounterOrder: action.snapshot.encounters.map((item) => item.id)
        }))
      );
    }

    default:
      return undefined;
  }
}
