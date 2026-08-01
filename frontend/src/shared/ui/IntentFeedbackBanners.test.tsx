// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import { IntentFeedbackToasts } from "@/shared/ui/IntentFeedbackBanners";

describe("IntentFeedbackToasts", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("keeps pending feedback visible while success and error toasts expire", async () => {
    const state = structuredClone(initialState);
    state.uiState.intentFeedback = [
      {
        id: "error-1",
        status: "error",
        message: "Save failed",
        createdAt: "2026-07-31T00:00:00Z"
      },
      {
        id: "success-1",
        status: "success",
        message: "Save complete",
        createdAt: "2026-07-31T00:00:00Z"
      },
      {
        id: "pending-1",
        status: "pending",
        message: "Save pending",
        createdAt: "2026-07-31T00:00:00Z"
      }
    ];

    await act(async () => {
      root.render(
        <StoreContext.Provider value={{ state, dispatch: () => undefined }}>
          <IntentFeedbackToasts />
        </StoreContext.Provider>
      );
    });

    expect(container.textContent).toContain("Save pending");
    expect(container.textContent).toContain("Save complete");
    expect(container.textContent).toContain("Save failed");

    await act(async () => vi.advanceTimersByTime(4000));
    expect(container.textContent).toContain("Save pending");
    expect(container.textContent).not.toContain("Save complete");
    expect(container.textContent).toContain("Save failed");

    await act(async () => vi.advanceTimersByTime(4000));
    expect(container.textContent).toContain("Save pending");
    expect(container.textContent).not.toContain("Save failed");
  });

  it("dismisses a toast locally without dispatching a history mutation", async () => {
    const state = structuredClone(initialState);
    state.uiState.intentFeedback = [
      {
        id: "pending-1",
        status: "pending",
        message: "Still working",
        createdAt: "2026-07-31T00:00:00Z"
      }
    ];
    const dispatch = vi.fn();

    await act(async () => {
      root.render(
        <StoreContext.Provider value={{ state, dispatch }}>
          <IntentFeedbackToasts />
        </StoreContext.Provider>
      );
    });
    const dismiss = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Dismiss pending notification"]'
    );
    await act(async () => dismiss?.click());

    expect(container.textContent).not.toContain("Still working");
    expect(dispatch).not.toHaveBeenCalled();
  });
});
