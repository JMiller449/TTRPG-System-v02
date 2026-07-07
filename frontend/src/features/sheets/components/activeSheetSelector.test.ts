import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import { ActiveSheetSelector } from "@/features/sheets/components/ActiveSheetSelector";

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
    expect(markup.indexOf("instance_2")).toBeLessThan(markup.indexOf("instance_1"));
    expect(markup).toContain('value="instance_1" selected=""');
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

    expect(markup).toContain('value="instance_2" selected=""');
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
});
