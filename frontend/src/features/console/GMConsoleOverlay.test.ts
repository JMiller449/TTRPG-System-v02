import { describe, expect, it } from "vitest";
import { GM_NAV_ITEMS, isGMOverlayShortcut } from "@/features/console/gmNavigation";

describe("GM console overlay", () => {
  it("recognizes the Alt+G quick-control shortcut", () => {
    expect(isGMOverlayShortcut({ altKey: true, key: "g" })).toBe(true);
    expect(isGMOverlayShortcut({ altKey: true, key: "G" })).toBe(true);
    expect(isGMOverlayShortcut({ altKey: false, key: "g" })).toBe(false);
    expect(isGMOverlayShortcut({ altKey: true, key: "x" })).toBe(false);
  });

  it("offers every GM page once in the quick navigation list", () => {
    const views = GM_NAV_ITEMS.map((item) => item.view);

    expect(new Set(views).size).toBe(views.length);
    expect(views).toEqual([
      "console",
      "sheet_viewer",
      "template_library",
      "create_template",
      "encounter_presets",
      "item_maker",
      "formula_authoring",
      "proficiency_authoring",
      "condition_authoring",
      "action_authoring",
      "state_backup"
    ]);
  });
});
