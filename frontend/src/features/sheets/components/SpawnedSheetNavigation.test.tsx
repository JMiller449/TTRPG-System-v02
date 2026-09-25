import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import {
  ActiveSheetNamePicker,
  SpawnedSheetOrganizer
} from "@/features/sheets/components/SpawnedSheetNavigation";
import type { GameClient } from "@/hooks/useGameClient";

function spawnedSheetState() {
  return {
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
}

describe("SpawnedSheetNavigation", () => {
  it("renders the active authoritative sheet as a searchable header picker", () => {
    const markup = renderToStaticMarkup(
      createElement(
        StoreContext.Provider,
        { value: { state: spawnedSheetState(), dispatch: () => undefined } },
        createElement(ActiveSheetNamePicker)
      )
    );

    expect(markup).toContain("Active spawned sheet");
    expect(markup).toContain('value="instance_1"');
    expect(markup).toContain('role="combobox"');
    expect(markup).not.toContain("Organize Sheets");
  });

  it("defaults the picker to the first available sheet", () => {
    const baseState = spawnedSheetState();
    const state = {
      ...baseState,
      uiState: {
        ...baseState.uiState,
        activeSheetId: null
      }
    };
    const markup = renderToStaticMarkup(
      createElement(
        StoreContext.Provider,
        { value: { state, dispatch: () => undefined } },
        createElement(ActiveSheetNamePicker)
      )
    );

    expect(markup).toContain('value="instance_2"');
    expect(markup).not.toContain('value=""');
  });

  it("shows a disabled picker when no sheets are available", () => {
    const markup = renderToStaticMarkup(
      createElement(
        StoreContext.Provider,
        { value: { state: initialState, dispatch: () => undefined } },
        createElement(ActiveSheetNamePicker)
      )
    );

    expect(markup).toContain("No spawned sheets available");
    expect(markup).toContain("disabled");
  });

  it("renders organization inline instead of in a modal", () => {
    const client = { sendProtocolRequest: () => undefined } as unknown as GameClient;
    const markup = renderToStaticMarkup(
      createElement(
        StoreContext.Provider,
        { value: { state: spawnedSheetState(), dispatch: () => undefined } },
        createElement(SpawnedSheetOrganizer, { client })
      )
    );

    expect(markup).toContain("Organize Spawned Sheets");
    expect(markup).toContain("Catalog root");
    expect(markup).not.toContain('role="dialog"');
  });
});
