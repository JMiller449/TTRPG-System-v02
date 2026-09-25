// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import type { GameClient } from "@/hooks/useGameClient";

const channelMocks = vi.hoisted(() => ({
  discover: vi.fn()
}));

vi.mock("@/features/extension/bridgeUserscriptChannel", () => ({
  discoverBridgeUserscript: channelMocks.discover
}));

import { ConsoleSidebarStatus } from "@/features/console/ConsoleSidebarStatus";

const endSession = vi.fn();
const client: GameClient = {
  connect: async () => undefined,
  disconnect: () => undefined,
  endSession,
  sendProtocolRequest: vi.fn(),
  authenticate: () => undefined,
  authenticateWithCode: () => undefined,
  onEvent: () => () => undefined
};

const connectedState = {
  ...initialState,
  serverState: { ...initialState.serverState, role: "gm" as const, gmAuthenticated: true },
  uiState: {
    ...initialState.uiState,
    connection: { status: "connected" as const }
  }
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  channelMocks.discover.mockReset();
  endSession.mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderStatus(): Promise<void> {
  await act(async () => {
    root.render(
      createElement(
        StoreContext.Provider,
        { value: { state: connectedState, dispatch: () => undefined } },
        createElement(ConsoleSidebarStatus, { client })
      )
    );
    await Promise.resolve();
  });
}

describe("ConsoleSidebarStatus", () => {
  it("renders operational status without duplicate workspace identity", async () => {
    channelMocks.discover.mockResolvedValue({
      nonce: "nonce-1",
      version: "1.1.0",
      synchronized: true,
      environment: "development",
      endpoint: "ws://127.0.0.1:6767/ws/chat",
      bindingKey: "dm",
      bindingLabel: "DM"
    });

    await renderStatus();

    expect(container.querySelector("footer")?.getAttribute("aria-label")).toBe(
      "Application status"
    );
    expect(container.textContent).toContain("Backend");
    expect(container.textContent).toContain("Extension");
    expect(container.textContent).toContain("History 0");
    expect(container.textContent).not.toContain("GM Workspace");
    expect(container.textContent).not.toContain("Characters");
  });

  it("reports missing extension state and ends the session from the footer", async () => {
    channelMocks.discover.mockResolvedValue(null);
    await renderStatus();

    expect(container.querySelector('[aria-label="Extension Not Detected"]')).not.toBeNull();
    await act(async () => {
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Exit")
        ?.click();
    });
    expect(endSession).toHaveBeenCalledOnce();
  });
});
