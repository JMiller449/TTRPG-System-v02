import type { AppAction, AppState } from "@/app/state/types";

export function connectionReducer(state: AppState, action: AppAction): AppState | undefined {
  switch (action.type) {
    case "connection_status":
      return { ...state, connection: { ...state.connection, status: action.status } };
    case "connection_error":
      return { ...state, connection: { ...state.connection, error: action.error } };
    default:
      return undefined;
  }
}
