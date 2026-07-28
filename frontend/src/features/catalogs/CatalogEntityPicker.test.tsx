// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";

describe("CatalogEntityPicker", () => {
  it("opens organized catalogs as collapsible nested folders and selects an entry", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onSelect = vi.fn();

    await act(async () => {
      root.render(
        <StoreContext.Provider value={{ state, dispatch: vi.fn() }}>
          <CatalogEntityPicker
            catalog="items"
            label="Item"
            placeholder="Search items"
            options={[{ id: "longsword", label: "Longsword", value: "longsword" }]}
            onSelect={onSelect}
          />
        </StoreContext.Provider>
      );
    });

    const input = container.querySelector<HTMLInputElement>('[role="combobox"]');
    await act(async () => {
      input?.focus();
      input?.click();
      await Promise.resolve();
    });
    expect(document.body.textContent).toContain("Weapons");
    expect(document.body.textContent).not.toContain("Longsword");

    const weapons = [...document.body.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "▸Weapons"
    );
    await act(async () => weapons?.click());
    const swords = [...document.body.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "▸Swords"
    );
    await act(async () => swords?.click());
    const longsword = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (option) => option.textContent?.includes("Longsword")
    );
    await act(async () => longsword?.click());

    expect(onSelect).toHaveBeenCalledWith("longsword");
    expect(input?.getAttribute("aria-expanded")).toBe("false");

    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps folders collapsed when organization arrives after the picker mounts", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const initial = structuredClone(initialState);
    const organized = structuredClone(initialState);
    organized.serverState.catalogFolders.weapons = {
      id: "weapons",
      catalog: "items",
      name: "Weapons",
      parent_id: null,
      position: 0
    };
    organized.serverState.catalogEntries["items:longsword"] = {
      id: "items:longsword",
      catalog: "items",
      entry_id: "longsword",
      folder_id: "weapons",
      position: 0
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const renderPicker = (state: typeof initial): JSX.Element => (
      <StoreContext.Provider value={{ state, dispatch: vi.fn() }}>
        <CatalogEntityPicker
          catalog="items"
          label="Item"
          placeholder="Search items"
          options={[{ id: "longsword", label: "Longsword", value: "longsword" }]}
          onSelect={() => undefined}
        />
      </StoreContext.Provider>
    );

    await act(async () => root.render(renderPicker(initial)));
    const input = container.querySelector<HTMLInputElement>('[role="combobox"]');
    await act(async () => {
      input?.focus();
      await Promise.resolve();
    });
    await act(async () => root.render(renderPicker(organized)));

    expect(document.body.textContent).toContain("Weapons");
    expect(document.body.textContent).not.toContain("Longsword");

    await act(async () => root.unmount());
    container.remove();
  });
});
