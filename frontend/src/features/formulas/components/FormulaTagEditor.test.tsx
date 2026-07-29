// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import { FormulaTagEditor } from "@/features/formulas/components/FormulaTagEditor";

describe("FormulaTagEditor", () => {
  it("uses the managed nested tag catalog inside the application store", () => {
    const state = structuredClone(initialState);
    state.serverState.tags.damage = {
      id: "damage",
      name: "Damage",
      description: "Damage formula context"
    };
    state.serverState.tagOrder = ["damage"];

    const markup = renderToStaticMarkup(
      <StoreContext.Provider value={{ state, dispatch: () => undefined }}>
        <FormulaTagEditor tags={[]} onChange={() => undefined} />
      </StoreContext.Provider>
    );

    expect(markup).toContain("Search Formula Tags");
    expect(markup).toContain("Select tag Damage");
    expect(markup).not.toContain('role="combobox"');
    expect(markup).not.toContain("Create custom tag");
  });

  it("selects existing suggestions without offering free-form creation", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);

    function Harness(): JSX.Element {
      const [tags, setTags] = useState<string[]>([]);
      return (
        <FormulaTagEditor
          tags={tags}
          suggestions={["damage", "healing"]}
          onChange={setTags}
        />
      );
    }

    await act(async () => root.render(<Harness />));
    const damage = container.querySelector<HTMLInputElement>(
      'input[aria-label="Select tag damage"]'
    );
    expect(damage?.checked).toBe(false);

    await act(async () => damage?.click());
    expect(
      container.querySelector<HTMLInputElement>('input[aria-label="Select tag damage"]')?.checked
    ).toBe(true);

    const search = container.querySelector<HTMLInputElement>('input[type="search"]');
    await act(async () => {
      if (search) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value"
        )?.set;
        setter?.call(search, "homebrew");
        search.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    expect(container.textContent).toContain("No managed tags match this search.");
    expect(container.textContent).not.toContain("Create custom tag");

    await act(async () => root.unmount());
  });
});
