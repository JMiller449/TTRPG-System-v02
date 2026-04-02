import type { AppAction, AppState } from "@/app/state/types";
import { updateUiState } from "@/app/state/reducer/shared";

const MAX_INTENT_FEEDBACK_ITEMS = 3;

function pushIntentFeedback(state: AppState, action: Extract<AppAction, { type: "push_intent_feedback" }>): AppState {
  const { intentFeedback } = state.uiState;
  const withoutResolvedPending =
    action.item.status === "pending" || !action.item.intentId
      ? intentFeedback
      : intentFeedback.filter(
          (item) => !(item.intentId === action.item.intentId && item.status === "pending")
        );
  const deduped = withoutResolvedPending.filter(
    (item) => !(item.status === action.item.status && item.message === action.item.message)
  );

  return updateUiState(state, (uiState) => ({
    ...uiState,
    intentFeedback: [action.item, ...deduped].slice(0, MAX_INTENT_FEEDBACK_ITEMS)
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
        pendingIntentIds: uiState.pendingIntentIds.filter((intentId) => intentId !== action.intentId)
      }));
    case "push_intent_feedback":
      return pushIntentFeedback(state, action);
    case "dismiss_intent_feedback":
      return updateUiState(state, (uiState) => ({
        ...uiState,
        intentFeedback: uiState.intentFeedback.filter((item) => item.id !== action.id)
      }));
    default:
      return undefined;
  }
}
