import type { AppAction, AppState } from "@/app/state/types";
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
      const proficiencies = Object.fromEntries(
        action.snapshot.proficiencies.map((item) => [item.id, item])
      );
      const actions = Object.fromEntries(action.snapshot.actions.map((item) => [item.id, item]));
      const formulas = Object.fromEntries(action.snapshot.formulas.map((item) => [item.id, item]));
      const augmentations = Object.fromEntries(
        (action.snapshot.augmentations ?? []).map((item) => [item.id, item])
      );
      const conditionPresets = Object.fromEntries(
        action.snapshot.conditionPresets.map((item) => [item.id, item])
      );
      const encounters = Object.fromEntries(
        action.snapshot.encounters.map((item) => [item.id, item])
      );
      const actionHistory = Object.fromEntries(
        action.snapshot.actionHistory.map((item) => [item.id, item])
      );
      return normalizeUiSelections(
        updateServerState(state, (serverState) => ({
          ...serverState,
          sheets,
          sheetOrder: action.snapshot.sheets.map((item) => item.id),
          persistentSheets,
          persistentSheetOrder: action.snapshot.persistentSheets.map((item) => item.id),
          items,
          itemOrder: action.snapshot.items.map((item) => item.id),
          proficiencies,
          proficiencyOrder: action.snapshot.proficiencies.map((item) => item.id),
          actions,
          actionOrder: action.snapshot.actions.map((item) => item.id),
          formulas,
          formulaOrder: action.snapshot.formulas.map((item) => item.id),
          augmentations,
          augmentationOrder: (action.snapshot.augmentations ?? []).map((item) => item.id),
          conditionPresets,
          conditionPresetOrder: action.snapshot.conditionPresets.map((item) => item.id),
          encounters,
          encounterOrder: action.snapshot.encounters.map((item) => item.id),
          actionHistory,
          actionHistoryOrder: action.snapshot.actionHistory.map((item) => item.id)
        }))
      );
    }

    default:
      return undefined;
  }
}
