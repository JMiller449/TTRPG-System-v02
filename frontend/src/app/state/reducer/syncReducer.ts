import type { PatchOp } from "@/domain/ipc";
import type { AppAction, AppState, ServerState } from "@/app/state/types";
import { removeById, updateServerState, updateUiState, upsert } from "@/app/state/reducer/shared";

function upsertPersistentSheet(
  map: ServerState["persistentSheets"],
  order: string[],
  id: string,
  value: ServerState["persistentSheets"][string]
): { map: ServerState["persistentSheets"]; order: string[] } {
  const nextMap = { ...map, [id]: value };
  const exists = order.includes(id);
  return {
    map: nextMap,
    order: exists ? order : [...order, id]
  };
}

function applyPatch(state: ServerState, op: PatchOp): ServerState {
  switch (op.op) {
    case "upsert_sheet": {
      const next = upsert(state.sheets, state.sheetOrder, op.value);
      return { ...state, sheets: next.map, sheetOrder: next.order };
    }

    case "remove_sheet": {
      const next = removeById(state.sheets, state.sheetOrder, op.value.id);
      const nextPresentation = { ...state.sheetPresentation };
      delete nextPresentation[op.value.id];
      return { ...state, sheets: next.map, sheetOrder: next.order, sheetPresentation: nextPresentation };
    }

    case "upsert_persistent_sheet": {
      const next = upsertPersistentSheet(
        state.persistentSheets,
        state.persistentSheetOrder,
        op.value.id,
        op.value.value
      );
      return { ...state, persistentSheets: next.map, persistentSheetOrder: next.order };
    }

    case "remove_persistent_sheet": {
      const next = removeById(state.persistentSheets, state.persistentSheetOrder, op.value.id);
      const nextPresentation = { ...state.persistentSheetPresentation };
      delete nextPresentation[op.value.id];
      return {
        ...state,
        persistentSheets: next.map,
        persistentSheetOrder: next.order,
        persistentSheetPresentation: nextPresentation
      };
    }

    case "upsert_sheet_presentation":
      return {
        ...state,
        sheetPresentation: {
          ...state.sheetPresentation,
          [op.value.sheetId]: op.value.presentation
        }
      };

    case "upsert_persistent_sheet_presentation":
      return {
        ...state,
        persistentSheetPresentation: {
          ...state.persistentSheetPresentation,
          [op.value.persistentSheetId]: op.value.presentation
        }
      };

    case "upsert_encounter": {
      const next = upsert(state.encounters, state.encounterOrder, op.value);
      return { ...state, encounters: next.map, encounterOrder: next.order };
    }

    case "remove_encounter": {
      const next = removeById(state.encounters, state.encounterOrder, op.value.id);
      return { ...state, encounters: next.map, encounterOrder: next.order };
    }

    case "set_active_sheet":
    case "add_roll_log":
    case "update_roll_log":
    default:
      return state;
  }
}

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
          sheetPresentation,
          persistentSheetPresentation,
          encounters,
          encounterOrder: action.snapshot.encounters.map((item) => item.id)
        }))
      );
    }

    case "apply_patch":
      return normalizeUiSelections(
        updateServerState(state, (serverState) => action.ops.reduce(applyPatch, serverState))
      );

    default:
      return undefined;
  }
}
