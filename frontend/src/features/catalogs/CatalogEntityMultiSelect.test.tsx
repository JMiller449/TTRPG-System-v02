// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import { CatalogEntityMultiSelect } from "@/features/catalogs/CatalogEntityMultiSelect";

describe("CatalogEntityMultiSelect", () => {
  it("bulk-selects nested folder descendants and exposes partial selection", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const state = structuredClone(initialState);
    state.serverState.catalogFolders.party = {
      id: "party",
      catalog: "sheet_instances",
      name: "Party",
      parent_id: null,
      position: 0
    };
    state.serverState.catalogEntries["sheet_instances:hero"] = {
      id: "sheet_instances:hero",
      catalog: "sheet_instances",
      entry_id: "hero",
      folder_id: "party",
      position: 0
    };
    state.serverState.catalogEntries["sheet_instances:rival"] = {
      id: "sheet_instances:rival",
      catalog: "sheet_instances",
      entry_id: "rival",
      folder_id: "party",
      position: 1
    };
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <StoreContext.Provider value={{ state, dispatch: vi.fn() }}>
          <CatalogEntityMultiSelect
            catalog="sheet_instances"
            label="Allowed player sheets"
            options={[
              { id: "hero", label: "Hero" },
              { id: "rival", label: "Rival" }
            ]}
            selectedIds={["hero"]}
            onChange={onChange}
          />
        </StoreContext.Provider>
      );
    });

    const folderCheckbox = container.querySelector<HTMLInputElement>(
      'input[aria-label="Allow all players in Party"]'
    );
    expect(folderCheckbox?.indeterminate).toBe(true);
    expect(container.textContent).not.toContain("Rival");

    await act(async () =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Expand Party"]')?.click()
    );
    expect(container.textContent).toContain("Hero");
    expect(container.textContent).toContain("Rival");

    await act(async () => folderCheckbox?.click());
    expect(onChange).toHaveBeenCalledWith(["hero", "rival"]);

    await act(async () => root.unmount());
    container.remove();
  });
});
