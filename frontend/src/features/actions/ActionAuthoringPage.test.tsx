// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import type { AppState } from "@/app/state/types";
import { ActionAuthoringPage } from "@/features/actions/ActionAuthoringPage";
import type { GameClient } from "@/hooks/useGameClient";

function renderPage(
  root: ReturnType<typeof createRoot>,
  state: AppState,
  client: GameClient
): void {
  root.render(
    <StoreContext.Provider value={{ state, dispatch: vi.fn() }}>
      <ActionAuthoringPage client={client} />
    </StoreContext.Provider>
  );
}

describe("ActionAuthoringPage", () => {
  it("retains failed drafts and reconciles to the authoritative action after success", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const sendProtocolRequest = vi.fn();
    const client = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      endSession: vi.fn(),
      sendProtocolRequest,
      authenticate: vi.fn(),
      authenticateWithCode: vi.fn(),
      onEvent: vi.fn(() => () => undefined)
    } as unknown as GameClient;
    const initial = structuredClone(initialState);

    await act(async () => {
      renderPage(root, initial, client);
      await Promise.resolve();
    });

    const nameInput = container.querySelector<HTMLInputElement>('input[aria-invalid="true"]');
    expect(nameInput).not.toBeNull();
    await act(async () => {
      if (!nameInput) {
        return;
      }
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      valueSetter?.call(nameInput, "Shield Bash");
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });

    const createButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Create Action"
    );
    expect(createButton?.disabled).toBe(false);
    await act(async () => {
      createButton?.click();
      await Promise.resolve();
    });

    const createCall = sendProtocolRequest.mock.calls.find(
      ([request]) => request.type === "create_action"
    );
    expect(createCall).toBeDefined();
    const request = createCall?.[0];
    expect(request?.request_id).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("Shield Bash");
    expect(container.textContent).toContain("Creating…");
    expect(container.textContent).not.toContain("Name is required.");

    if (!request || request.type !== "create_action" || !request.request_id) {
      throw new Error("Expected a correlated create_action request.");
    }
    const failed = structuredClone(initialState);
    failed.uiState.intentFeedback = [
      {
        id: "feedback-error",
        intentId: request.request_id,
        status: "error",
        message: "Create action rejected: duplicate ID.",
        createdAt: "2026-07-16T00:00:00Z"
      }
    ];

    await act(async () => {
      renderPage(root, failed, client);
      await Promise.resolve();
    });

    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("Shield Bash");
    const retryButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Create Action"
    );
    expect(retryButton?.disabled).toBe(false);
    await act(async () => {
      retryButton?.click();
      await Promise.resolve();
    });
    const createCalls = sendProtocolRequest.mock.calls.filter(
      ([candidate]) => candidate.type === "create_action"
    );
    const retryRequest = createCalls.at(-1)?.[0];
    if (!retryRequest || retryRequest.type !== "create_action" || !retryRequest.request_id) {
      throw new Error("Expected a correlated retry request.");
    }

    const succeeded = structuredClone(initialState);
    succeeded.serverState.actions[retryRequest.action.id] = retryRequest.action;
    succeeded.serverState.actionOrder = [retryRequest.action.id];
    succeeded.uiState.intentFeedback = [
      {
        id: "feedback-success",
        intentId: retryRequest.request_id,
        status: "success",
        message: "Create action: Shield Bash synced.",
        createdAt: "2026-07-16T00:00:00Z"
      }
    ];

    await act(async () => {
      renderPage(root, succeeded, client);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Action “Shield Bash” created.");
    expect(container.textContent).toContain("Edit Action");
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("Shield Bash");

    await act(async () => root.unmount());
  });
});
