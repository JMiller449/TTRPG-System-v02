// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import type { AppState } from "@/app/state/types";
import { StoreContext } from "@/app/state/storeContext";
import { CatalogBrowser } from "@/features/catalogs/CatalogBrowser";
import type { GameClient } from "@/hooks/useGameClient";

function catalogState(): AppState {
  const state = structuredClone(initialState);
  state.serverState.catalogFolders.weapons = {
    id: "weapons",
    catalog: "items",
    name: "Weapons",
    parent_id: null,
    position: 0
  };
  state.serverState.catalogFolders.swords = {
    id: "swords",
    catalog: "items",
    name: "Swords",
    parent_id: "weapons",
    position: 0
  };
  state.serverState.catalogEntries["items:longsword"] = {
    id: "items:longsword",
    catalog: "items",
    entry_id: "longsword",
    folder_id: "swords",
    position: 0
  };
  return state;
}

describe("CatalogBrowser", () => {
  it("renders reusable nested folders, creation actions, and placed entries", () => {
    const state = catalogState();
    const client = {
      sendProtocolRequest: vi.fn()
    } as unknown as GameClient;

    const markup = renderToStaticMarkup(
      <StoreContext.Provider value={{ state, dispatch: vi.fn() }}>
        <CatalogBrowser
          catalog="items"
          client={client}
          items={[{ id: "longsword", name: "Longsword" }]}
          selectedId="longsword"
          entityLabel="item"
          emptyMessage="No items."
          onSelect={() => undefined}
          onCreateEntry={() => undefined}
        />
      </StoreContext.Provider>
    );

    expect(markup).toContain("Catalog root");
    expect(markup).toContain("Weapons");
    expect(markup).toContain("Swords");
    expect(markup).toContain("Longsword");
    expect(markup).toContain("New item");
    expect(markup).toContain("New folder");
    expect(markup).toContain('draggable="true"');
  });

  it("collapses folders, reveals search matches, creates folders, and moves entries", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const state = catalogState();
    const container = document.createElement("div");
    const root = createRoot(container);
    const sendProtocolRequest = vi.fn();
    const client = { sendProtocolRequest } as unknown as GameClient;
    const onCreateEntry = vi.fn();

    await act(async () => {
      root.render(
        <StoreContext.Provider value={{ state, dispatch: vi.fn() }}>
          <CatalogBrowser
            catalog="items"
            client={client}
            items={[{ id: "longsword", name: "Longsword" }]}
            selectedId={null}
            entityLabel="item"
            emptyMessage="No items."
            onSelect={() => undefined}
            onCreateEntry={onCreateEntry}
          />
        </StoreContext.Provider>
      );
    });

    const weaponsToggle = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Weapons")
    );
    await act(async () => weaponsToggle?.click());
    expect(container.textContent).not.toContain("Longsword");

    const search = container.querySelector<HTMLInputElement>('input[type="search"]');
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      valueSetter?.call(search, "Longsword");
      search?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.textContent).toContain("Longsword");

    const rootMenu = container.querySelector<HTMLDetailsElement>(
      ".catalog-browser__root-row .catalog-browser__add-menu"
    );
    await act(async () => {
      rootMenu?.setAttribute("open", "");
      const rootNewItem = [...(rootMenu?.querySelectorAll("button") ?? [])].find(
        (button) => button.textContent === "New item"
      );
      rootNewItem?.click();
    });
    expect(rootMenu?.open).toBe(false);
    expect(onCreateEntry).toHaveBeenCalledWith(null);

    await act(async () => {
      valueSetter(search, "");
      rootMenu?.setAttribute("open", "");
      const rootNewFolder = [...container.querySelectorAll("button")].find(
        (button) => button.textContent === "New folder"
      );
      rootNewFolder?.click();
      expect(rootMenu?.open).toBe(false);
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain("Add a display folder at the catalog root.");
    const folderName = container.querySelector<HTMLInputElement>('input[aria-label="Folder name"]');
    await act(async () => {
      valueSetter(folderName, "Magic");
      folderName?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      folderName?.form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(sendProtocolRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "create_catalog_folder",
        catalog: "items",
        name: "Magic",
        parent_id: null
      }),
      "Create folder: Magic"
    );

    await act(async () => weaponsToggle?.click());
    const data = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "none",
      getData: (type: string) => data.get(type) ?? "",
      setData: (type: string, value: string) => data.set(type, value)
    };
    const entry = container.querySelector(".catalog-browser__entry");
    const dragStart = new Event("dragstart", { bubbles: true, cancelable: true });
    Object.defineProperty(dragStart, "dataTransfer", { value: dataTransfer });
    await act(async () => entry?.dispatchEvent(dragStart));

    const weaponsFolder = weaponsToggle?.closest(".catalog-browser__folder");
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", { value: dataTransfer });
    await act(async () => weaponsFolder?.dispatchEvent(drop));
    expect(sendProtocolRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "move_catalog_node",
        catalog: "items",
        node_type: "entry",
        node_id: "longsword",
        parent_id: "weapons"
      }),
      "Move item"
    );

    await act(async () => root.unmount());
  });
});

function valueSetter(input: HTMLInputElement | null, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
}
