// @vitest-environment jsdom

import { act, createElement } from "react";
import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import { ActiveSheetSelector } from "@/features/sheets/components/ActiveSheetSelector";
import type { GameClient } from "@/hooks/useGameClient";

describe("ActiveSheetSelector", () => {
  it("renders authoritative instances in their backend order", () => {
    const state = {
      ...initialState,
      serverState: {
        ...initialState.serverState,
        persistentSheets: {
          instance_1: {
            parent_id: "missing_sheet",
            health: 10,
            mana: 5,
            augments: {}
          },
          instance_2: {
            parent_id: "missing_sheet",
            health: 20,
            mana: 10,
            augments: {}
          }
        },
        persistentSheetOrder: ["instance_2", "instance_1"]
      },
      uiState: {
        ...initialState.uiState,
        activeSheetId: "instance_1"
      }
    };
    const markup = renderToStaticMarkup(
      createElement(
        StoreContext.Provider,
        { value: { state, dispatch: () => undefined } },
        createElement(ActiveSheetSelector)
      )
    );

    expect(markup).toContain("Active spawned sheet");
    expect(markup).toContain('value="instance_1"');
    expect(markup).toContain('role="combobox"');
    expect(markup).not.toContain("No active spawned sheet");
  });

  it("defaults to the first available sheet and offers no empty selection", () => {
    const state = {
      ...initialState,
      serverState: {
        ...initialState.serverState,
        persistentSheets: {
          instance_1: {
            parent_id: "missing_sheet",
            health: 10,
            mana: 5,
            augments: {}
          },
          instance_2: {
            parent_id: "missing_sheet",
            health: 20,
            mana: 10,
            augments: {}
          }
        },
        persistentSheetOrder: ["instance_2", "instance_1"]
      }
    };
    const markup = renderToStaticMarkup(
      createElement(
        StoreContext.Provider,
        { value: { state, dispatch: () => undefined } },
        createElement(ActiveSheetSelector)
      )
    );

    expect(markup).toContain('value="instance_2"');
    expect(markup).not.toContain('value=""');
    expect(markup).not.toContain("No active spawned sheet");
  });

  it("shows a disabled empty state only when no sheets are available", () => {
    const markup = renderToStaticMarkup(
      createElement(
        StoreContext.Provider,
        { value: { state: initialState, dispatch: () => undefined } },
        createElement(ActiveSheetSelector)
      )
    );

    expect(markup).toContain("No spawned sheets available");
    expect(markup).toContain("disabled");
  });

  it("keeps lifecycle controls out of the selector when a client is provided", () => {
    const state = {
      ...initialState,
      serverState: {
        ...initialState.serverState,
        persistentSheets: {
          instance_1: {
            parent_id: "missing_sheet",
            health: 10,
            mana: 5,
            augments: {}
          }
        },
        persistentSheetOrder: ["instance_1"]
      }
    };
    const client = { sendProtocolRequest: () => undefined } as unknown as GameClient;
    const markup = renderToStaticMarkup(
      createElement(
        StoreContext.Provider,
        { value: { state, dispatch: () => undefined } },
        createElement(ActiveSheetSelector, { client })
      )
    );

    expect(markup).toContain("Organize Sheets");
    expect(markup).not.toContain("Despawn");
  });

  it("opens the spawned-sheet organizer in a modal", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const state = {
      ...initialState,
      serverState: {
        ...initialState.serverState,
        persistentSheets: {
          instance_1: {
            parent_id: "missing_sheet",
            health: 10,
            mana: 5,
            augments: {}
          }
        },
        persistentSheetOrder: ["instance_1"]
      }
    };
    const client = { sendProtocolRequest: () => undefined } as unknown as GameClient;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(
          StoreContext.Provider,
          { value: { state, dispatch: () => undefined } },
          createElement(ActiveSheetSelector, { client })
        )
      );
    });
    const organizerButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Organize Sheets"
    );
    expect(organizerButton?.getAttribute("aria-haspopup")).toBe("dialog");
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => organizerButton?.click());

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("Organize spawned sheets");
    expect(dialog?.textContent).toContain("Catalog root");

    await act(async () => root.unmount());
    container.remove();
  });
});
