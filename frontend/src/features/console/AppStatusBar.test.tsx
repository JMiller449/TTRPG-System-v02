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

import { AppStatusBar } from "@/features/console/AppStatusBar";

const client: GameClient = {
  connect: async () => undefined,
  disconnect: () => undefined,
  endSession: () => undefined,
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
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderStatusBar(): Promise<void> {
  await act(async () => {
    root.render(
      createElement(
        StoreContext.Provider,
        { value: { state: connectedState, dispatch: () => undefined } },
        createElement(AppStatusBar, { role: "gm", client })
      )
    );
    await Promise.resolve();
  });
}

describe("AppStatusBar", () => {
  it("reports a responding userscript as an extension connection", async () => {
    channelMocks.discover.mockResolvedValue({
      nonce: "nonce-1",
      version: "1.1.0",
      synchronized: true,
      environment: "development",
      endpoint: "ws://127.0.0.1:6767/ws/chat",
      bindingKey: "dm",
      bindingLabel: "DM"
    });

    await renderStatusBar();

    expect(container.textContent).toContain("Extension Connected");
    expect(container.textContent).not.toContain("Synced");
  });

  it("reports a missing userscript without claiming an extension connection", async () => {
    channelMocks.discover.mockResolvedValue(null);

    await renderStatusBar();

    expect(container.textContent).toContain("Extension Not Detected");
    expect(container.textContent).not.toContain("Extension Connected");
  });
});
