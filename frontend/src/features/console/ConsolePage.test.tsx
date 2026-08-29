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
  it("keeps sheet sections inside the shared sheet while exposing player workspaces", async () => {
    await act(async () => {
      root.render(
        createElement(
          StoreContext.Provider,
          { value: { state: initialState, dispatch: () => undefined } },
          createElement(ConsolePage, { client })
        )
      );
    });

    const extensionButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Install / Sync Bridge"
    );
    const sheetButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Character Sheet"
    );
    expect(extensionButton).toBeDefined();
    expect(sheetButton?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).not.toContain("Sheet Sections");
    expect(container.querySelector('[data-testid="player-sheet"]')).not.toBeNull();

    await act(async () => {
      extensionButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="player-extension"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="player-sheet"]')).toBeNull();
    expect(extensionButton?.getAttribute("aria-pressed")).toBe("true");
    expect(sheetButton?.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      sheetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="player-sheet"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="player-extension"]')).toBeNull();
    expect(sheetButton?.getAttribute("aria-pressed")).toBe("true");
  });
});
