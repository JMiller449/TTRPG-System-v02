import type { AppAction, AppState } from "@/app/state/types";
import { updateUiState } from "@/app/state/reducer/shared";

export function connectionReducer(state: AppState, action: AppAction): AppState | undefined {
  switch (action.type) {
    case "connection_status":
      return updateUiState(state, (uiState) => ({
        ...uiState,
        connection: { ...uiState.connection, status: action.status }
      }));
    case "connection_transport":
      return updateUiState(state, (uiState) => ({
        ...uiState,
        connection: { ...uiState.connection, transport: action.transport }
      }));
    case "connection_error":
      return updateUiState(state, (uiState) => ({
        ...uiState,
        connection: { ...uiState.connection, error: action.error }
      }));
    default:
      return undefined;
  }
}
