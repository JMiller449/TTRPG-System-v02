import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import { GMConsoleToolbar } from "@/features/console/GMConsoleToolbar";
import { GM_TOOLBAR_NAV_ITEMS } from "@/features/console/gmConsoleToolbarData";

describe("gmConsoleToolbar", () => {
  it("defines one unique option for every GM page", () => {
    const views = GM_TOOLBAR_NAV_ITEMS.map((item) => item.view);

    expect(new Set(views).size).toBe(views.length);
    expect(views).toEqual([
      "console",
      "sheet_viewer",
      "template_library",
      "create_template",
      "encounter_presets",
      "xp_tracker",
      "item_maker",
      "formula_authoring",
      "fact_authoring",
      "proficiency_authoring",
      "condition_authoring",
      "effect_authoring",
      "action_authoring",
      "state_backup"
    ]);
  });

  it("keeps active-sheet and encounter controls out of persistent navigation", () => {
    const markup = renderToStaticMarkup(
      createElement(
        StoreContext.Provider,
        { value: { state: initialState, dispatch: () => undefined } },
        createElement(GMConsoleToolbar)
      )
    );

    expect(markup).not.toContain("Active sheet");
    expect(markup).not.toContain("Select preset");
    expect(markup).not.toContain(">Spawn<");
  });
});
