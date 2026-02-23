import type { AppAction, AppState } from "@/app/state/types";

const MAX_INTENT_FEEDBACK_ITEMS = 6;

function pushIntentFeedback(state: AppState, action: Extract<AppAction, { type: "push_intent_feedback" }>): AppState {
  const trimmed =
    action.item.status === "pending" || !action.item.intentId
      ? state.intentFeedback
      : state.intentFeedback.filter(
          (item) => !(item.intentId === action.item.intentId && item.status === "pending")
        );

  return {
    ...state,
    intentFeedback: [action.item, ...trimmed].slice(0, MAX_INTENT_FEEDBACK_ITEMS)
  };
}

export function intentReducer(state: AppState, action: AppAction): AppState | undefined {
  switch (action.type) {
    case "queue_intent":
      return state.pendingIntentIds.includes(action.intentId)
        ? state
        : { ...state, pendingIntentIds: [...state.pendingIntentIds, action.intentId] };
    case "clear_intent":
      return {
        ...state,
        pendingIntentIds: state.pendingIntentIds.filter((intentId) => intentId !== action.intentId)
      };
    case "push_intent_feedback":
      return pushIntentFeedback(state, action);
    case "dismiss_intent_feedback":
      return {
        ...state,
        intentFeedback: state.intentFeedback.filter((item) => item.id !== action.id)
      };
    default:
      return undefined;
  }
}
