// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import { IntentFeedbackHistory } from "@/features/console/IntentFeedbackHistory";

describe("IntentFeedbackHistory", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("opens beside the status control and exposes session details and clearing", async () => {
    const state = structuredClone(initialState);
    state.uiState.intentFeedback = [
      {
        id: "feedback_1",
        intentId: "request_1",
        status: "error",
        message: "Create action rejected: invalid formula",
        createdAt: "2026-07-31T18:30:00Z"
      }
    ];
    const dispatch = vi.fn();

    await act(async () => {
      root.render(
        <StoreContext.Provider value={{ state, dispatch }}>
          <IntentFeedbackHistory />
        </StoreContext.Provider>
      );
    });
    const trigger = container.querySelector<HTMLButtonElement>(".feedback-history__trigger");
    expect(trigger?.textContent).toContain("History 1");

    await act(async () => trigger?.click());
    expect(container.textContent).toContain("Create action rejected: invalid formula");
    expect(container.textContent).toContain("Request: request_1");

    const clear = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Clear All"
    );
    await act(async () => (clear as HTMLButtonElement | undefined)?.click());
    expect(dispatch).toHaveBeenCalledWith({ type: "clear_intent_feedback" });
  });
});
