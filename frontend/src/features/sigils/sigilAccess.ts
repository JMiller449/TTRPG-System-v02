import type { AppState } from "@/app/state/types";

export function canAuthorSigils(state: AppState): boolean {
  return (
    state.serverState.role === "gm" ||
    Boolean(
      state.uiState.activeSheetId &&
      state.serverState.persistentSheets[state.uiState.activeSheetId]?.can_inscribe_sigils
    )
  );
}

export function canOpenSigils(state: AppState): boolean {
  return canAuthorSigils(state) || Object.keys(state.serverState.sigils).length > 0;
}
