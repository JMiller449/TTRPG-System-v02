import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import { GMConsoleToolbar } from "@/features/console/GMConsoleToolbar";
import {
  GM_TOOLBAR_NAV_GROUPS,
  GM_TOOLBAR_NAV_ITEMS
} from "@/features/console/gmConsoleToolbarData";

describe("gmConsoleToolbar", () => {
  it("defines one unique option for every GM page", () => {
    const views = GM_TOOLBAR_NAV_ITEMS.map((item) => item.view);

    expect(new Set(views).size).toBe(views.length);
    expect(views).toEqual([
      "console",
      "sheet_viewer",
      "template_library",
      "create_template",
      "action_authoring",
      "item_maker",
      "attribute_authoring",
      "formula_authoring",
      "proficiency_authoring",
      "condition_authoring",
      "effect_authoring",
      "encounter_presets",
      "xp_tracker",
      "state_backup"
    ]);
  });

  it("groups GM pages into task-oriented workspaces", () => {
    expect(GM_TOOLBAR_NAV_GROUPS.map((group) => group.label)).toEqual([
      "Session",
      "Templates",
      "Content",
      "Rules Data",
      "Status Effects",
      "Encounters",
      "Admin"
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
