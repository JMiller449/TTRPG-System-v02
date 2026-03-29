import { describe, expect, it } from "vitest";
import { initialState } from "@/app/state/initialState";
import { intentReducer } from "@/app/state/reducer/intentReducer";
import type { IntentFeedbackItem } from "@/app/state/types";

function makeFeedback(overrides: Partial<IntentFeedbackItem> = {}): IntentFeedbackItem {
  return {
    id: overrides.id ?? "feedback_1",
    status: overrides.status ?? "success",
    message: overrides.message ?? "Roll: strength synced.",
    createdAt: overrides.createdAt ?? "2026-03-29T00:00:00.000Z",
    intentId: overrides.intentId
  };
}

describe("intentReducer", () => {
  it("collapses duplicate feedback messages instead of stacking them", () => {
    const first = intentReducer(initialState, {
      type: "push_intent_feedback",
      item: makeFeedback({ id: "feedback_1" })
    });
    const second = intentReducer(first ?? initialState, {
      type: "push_intent_feedback",
      item: makeFeedback({ id: "feedback_2" })
    });

    expect(second?.intentFeedback).toHaveLength(1);
    expect(second?.intentFeedback[0]?.id).toBe("feedback_2");
  });

  it("keeps only the three most recent feedback banners", () => {
    const state = [
      makeFeedback({ id: "feedback_1", message: "one" }),
      makeFeedback({ id: "feedback_2", message: "two" }),
      makeFeedback({ id: "feedback_3", message: "three" }),
      makeFeedback({ id: "feedback_4", message: "four" })
    ].reduce(
      (currentState, item) =>
        intentReducer(currentState, {
          type: "push_intent_feedback",
          item
        }) ?? currentState,
      initialState
    );

    expect(state.intentFeedback).toHaveLength(3);
    expect(state.intentFeedback.map((item) => item.id)).toEqual([
      "feedback_4",
      "feedback_3",
      "feedback_2"
    ]);
  });
});
