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
  it("moves role-appropriate sheet sections into the sidebar", async () => {
    await act(async () => {
      root.render(
        createElement(
          StoreContext.Provider,
          { value: { state: initialState, dispatch: () => undefined } },
          createElement(ConsolePage, { client })
        )
      );
    });

    const extensionButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Extension")
    );
    const sheetButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Characters")
    );
    const denseButton = container.querySelector<HTMLButtonElement>("#sheet-tab-dense");
    const statsButton = container.querySelector<HTMLButtonElement>("#sheet-tab-stats");
    expect(extensionButton).toBeDefined();
    expect(sheetButton?.getAttribute("aria-expanded")).toBe("true");
    expect(denseButton?.getAttribute("aria-current")).toBe("page");
    expect(statsButton).not.toBeNull();
    expect(container.textContent).toContain("Session");
    expect(container.textContent).toContain("Admin");
    expect(container.textContent).not.toContain("Action History");
    expect(container.textContent).not.toContain("Backup & Undo");
    expect(container.textContent).not.toContain("Active Character");
    expect(container.textContent).not.toContain("Player character");
    expect(container.textContent).not.toContain("Sheet Sections");
    expect(container.querySelector('[data-testid="player-sheet"]')).not.toBeNull();

    await act(async () => {
      statsButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(statsButton?.getAttribute("aria-current")).toBe("page");
    expect(denseButton?.getAttribute("aria-current")).toBeNull();

    await act(async () => {
      extensionButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="player-extension"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="player-sheet"]')).toBeNull();
    expect(extensionButton?.getAttribute("aria-current")).toBe("page");
    expect(sheetButton?.getAttribute("aria-current")).toBeNull();
    expect(container.querySelector("#sheet-tab-dense")).toBeNull();

    await act(async () => {
      sheetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="player-sheet"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="player-extension"]')).toBeNull();
    expect(sheetButton?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector("#sheet-tab-dense")?.getAttribute("aria-current")).toBe("page");
  });
});
