// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import type { AppState } from "@/app/state/types";
import type { GameClient } from "@/hooks/useGameClient";

const channelMocks = vi.hoisted(() => ({
  discover: vi.fn(),
  synchronize: vi.fn()
}));

vi.mock("@/features/extension/bridgeUserscriptChannel", () => ({
  discoverBridgeUserscript: channelMocks.discover,
  synchronizeBridgeUserscript: channelMocks.synchronize
}));

import { ExtensionPage } from "@/features/extension/ExtensionPage";

const client: GameClient = {
  connect: async () => undefined,
  disconnect: () => undefined,
  endSession: () => undefined,
  sendProtocolRequest: vi.fn(),
  authenticate: () => undefined,
  authenticateWithCode: () => undefined,
  onEvent: () => () => undefined
};

const gmState = {
  ...initialState,
  serverState: { ...initialState.serverState, role: "gm" as const, gmAuthenticated: true },
  uiState: {
    ...initialState.uiState,
    roll20Bridge: {
      ...initialState.uiState.roll20Bridge,
      bindingKey: "dm",
      bindingLabel: "DM"
    }
  }
};

const playerState = {
  ...initialState,
  serverState: { ...initialState.serverState, role: "player" as const },
  uiState: {
    ...initialState.uiState,
    roll20Bridge: {
      ...initialState.uiState.roll20Bridge,
      bindingKey: "instance:hero-1",
      bindingLabel: "Hero"
    }
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
  channelMocks.synchronize.mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderPage(state: AppState = gmState): Promise<void> {
  await act(async () => {
    root.render(
      createElement(
        StoreContext.Provider,
        { value: { state, dispatch: () => undefined } },
        createElement(ExtensionPage, { client })
      )
    );
    await Promise.resolve();
  });
}

describe("ExtensionPage", () => {
  it("checks immediately and shows one setup stage when the userscript is absent", async () => {
    channelMocks.discover.mockResolvedValue(null);
    await renderPage();

    expect(container.textContent).toContain("Install Violentmonkey");
    expect(container.textContent).toContain("Install Roll20 Bridge");
    expect(container.textContent).toContain("Install button on the left side");
    expect(container.textContent).toContain("Reload this page");
    expect(container.textContent).toContain("Log in again");
    const steps = [...container.querySelectorAll("ol > li")].map((step) => step.textContent);
    expect(steps).toHaveLength(4);
    expect(steps[0]).toContain("Install Violentmonkey");
    expect(steps[1]).toContain("Install the Roll20 bridge script");
    expect(steps[2]).toContain("Reload this page");
    expect(steps[3]).toContain("Log in again");
    expect(container.querySelectorAll(".extension-install-step__action")).toHaveLength(3);
    expect(container.querySelector(".extension-stage__retry button")?.textContent).toBe(
      "Detect Again"
    );
    expect(container.textContent).not.toContain("Continue");
    expect(channelMocks.discover).toHaveBeenCalledTimes(1);
  });

  it("shows detected synchronized configuration without exposing a credential", async () => {
    channelMocks.discover.mockResolvedValue({
      nonce: "nonce-1",
      version: "1.0.0",
      synchronized: true,
      environment: "development",
      endpoint: "ws://127.0.0.1:6767/ws/chat",
      bindingKey: "dm",
      bindingLabel: "DM"
    });
    await renderPage();

    expect(container.textContent).toContain("Userscript v1.0.0");
    expect(container.textContent).toContain("ws://127.0.0.1:6767/ws/chat");
    expect(container.textContent).toContain("Resync Bridge");
    expect(container.textContent).toContain("Roll20 can stay closed");
    expect(container.querySelectorAll(".extension-sync__details > div")).toHaveLength(5);
    expect(container.textContent).not.toContain("SERVICE_AUTH_CODE");
  });

  it("allows a claimed player binding to synchronize its own userscript", async () => {
    channelMocks.discover.mockResolvedValue({
      nonce: "nonce-player",
      version: "1.1.0",
      synchronized: false,
      environment: null,
      endpoint: null,
      bindingKey: null,
      bindingLabel: null
    });
    await renderPage(playerState);

    const syncButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Sync Bridge"
    );
    expect(container.textContent).toContain("Current userHero");
    expect(syncButton).toBeDefined();
    expect(syncButton?.disabled).toBe(false);
  });
});
