import type { AppAction, AppState } from "@/app/state/types";
import { updateUiState } from "@/app/state/reducer/shared";

const MAX_INTENT_FEEDBACK_ITEMS = 50;

function pushIntentFeedback(
  state: AppState,
  action: Extract<AppAction, { type: "push_intent_feedback" }>
): AppState {
  const { intentFeedback } = state.uiState;
  if (
    !action.item.intentId &&
    intentFeedback.some(
      (item) => item.status === action.item.status && item.message === action.item.message
    )
  ) {
    return state;
  }
  const withoutCurrentLifecycle = action.item.intentId
    ? intentFeedback.filter((item) => item.intentId !== action.item.intentId)
    : intentFeedback;

  return updateUiState(state, (uiState) => ({
    ...uiState,
    intentFeedback: [action.item, ...withoutCurrentLifecycle].slice(0, MAX_INTENT_FEEDBACK_ITEMS)
  }));
}

export function intentReducer(state: AppState, action: AppAction): AppState | undefined {
  switch (action.type) {
    case "queue_intent":
      return state.uiState.pendingIntentIds.includes(action.intentId)
        ? state
        : updateUiState(state, (uiState) => ({
            ...uiState,
            pendingIntentIds: [...uiState.pendingIntentIds, action.intentId]
          }));
    case "clear_intent":
      return updateUiState(state, (uiState) => ({
        ...uiState,
        pendingIntentIds: uiState.pendingIntentIds.filter(
          (intentId) => intentId !== action.intentId
        )
      }));
    case "push_intent_feedback":
      return pushIntentFeedback(state, action);
    case "dismiss_intent_feedback":
      if (
        state.uiState.intentFeedback.some(
          (item) => item.id === action.id && item.status === "pending"
        )
      ) {
        return state;
      }
      return updateUiState(state, (uiState) => ({
        ...uiState,
        intentFeedback: uiState.intentFeedback.filter((item) => item.id !== action.id)
      }));
    case "clear_intent_feedback":
      return state.uiState.intentFeedback.every((item) => item.status === "pending")
        ? state
        : updateUiState(state, (uiState) => ({
            ...uiState,
            intentFeedback: uiState.intentFeedback.filter((item) => item.status === "pending")
          }));
    default:
      return undefined;
  }
}
