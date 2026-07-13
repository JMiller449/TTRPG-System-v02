// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import type { GameClient } from "@/hooks/useGameClient";

vi.mock("@/features/extension/ExtensionPage", () => ({
  ExtensionPage: () =>
    createElement("div", { "data-testid": "player-extension" }, "Extension setup")
}));
vi.mock("@/features/sheets/PlayerCharacterSheet", () => ({
  PlayerCharacterSheet: () => createElement("div", { "data-testid": "player-sheet" }, "Sheet")
}));

import { ConsolePage } from "@/features/console/ConsolePage";

const client: GameClient = {
  connect: async () => undefined,
  disconnect: () => undefined,
  endSession: () => undefined,
  sendProtocolRequest: vi.fn(),
  authenticate: () => undefined,
  authenticateWithCode: () => undefined,
  onEvent: () => () => undefined
};

let container: HTMLDivElement;
let root: Root;

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

describe("ConsolePage player navigation", () => {
  it("exposes the Extension setup from the player workspace", async () => {
    await act(async () => {
      root.render(
        createElement(
          StoreContext.Provider,
          { value: { state: initialState, dispatch: () => undefined } },
          createElement(ConsolePage, { role: "player", client })
        )
      );
    });

    const extensionButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Extension"
    );
    expect(extensionButton).toBeDefined();

    await act(async () => {
      extensionButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="player-extension"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="player-sheet"]')).toBeNull();
  });
});
