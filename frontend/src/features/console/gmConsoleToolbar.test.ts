import { describe, expect, it } from "vitest";
import { GM_TOOLBAR_NAV_ITEMS, orderedEncounterPresets } from "@/features/console/gmConsoleToolbar";

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
      "proficiency_authoring",
      "condition_authoring",
      "effect_authoring",
      "action_authoring",
      "state_backup"
    ]);
  });

  it("orders encounter options by authoritative encounter order and skips stale ids", () => {
    const encounters = {
      second: {
        id: "second",
        name: "Second Encounter",
        entries: [],
        updatedAt: "2026-06-27T00:00:00Z"
      },
      first: {
        id: "first",
        name: "First Encounter",
        entries: [],
        updatedAt: "2026-06-26T00:00:00Z"
      }
    };

    expect(orderedEncounterPresets(encounters, ["first", "missing", "second"])).toEqual([
      encounters.first,
      encounters.second
    ]);
  });
});
