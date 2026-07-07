import type { GMView } from "@/app/state/types";

export interface GMToolbarNavItem {
  view: GMView;
  label: string;
  glyph: string;
}

export interface GMToolbarNavGroup {
  label: string;
  items: readonly GMToolbarNavItem[];
}

export const GM_TOOLBAR_NAV_GROUPS: readonly GMToolbarNavGroup[] = [
  {
    label: "Session",
    items: [
      { view: "console", label: "Dashboard", glyph: "DB" },
      { view: "sheet_viewer", label: "Spawned Sheets", glyph: "SP" },
      { view: "action_history", label: "Action History", glyph: "AH" }
    ]
  },
  {
    label: "Templates",
    items: [
      { view: "template_library", label: "Library", glyph: "LB" },
      { view: "create_template", label: "Builder", glyph: "BD" }
    ]
  },
  {
    label: "Content",
    items: [
      { view: "action_authoring", label: "Actions", glyph: "AC" },
      { view: "item_maker", label: "Items", glyph: "IT" }
    ]
  },
  {
    label: "Rules Data",
    items: [
      { view: "attribute_authoring", label: "Attributes", glyph: "AT" },
      { view: "formula_authoring", label: "Formulas", glyph: "FX" },
      { view: "proficiency_authoring", label: "Proficiencies", glyph: "PF" }
    ]
  },
  {
    label: "Status Effects",
    items: [
      { view: "condition_authoring", label: "Conditions", glyph: "CD" },
      { view: "effect_authoring", label: "Standalone Effects", glyph: "EF" }
    ]
  },
  {
    label: "Encounters",
    items: [
      { view: "encounter_presets", label: "Presets", glyph: "EN" },
      { view: "xp_tracker", label: "XP", glyph: "XP" }
    ]
  },
  {
    label: "Admin",
    items: [
      { view: "state_backup", label: "Backup & Undo", glyph: "BK" },
      { view: "extension", label: "Extension", glyph: "EX" }
    ]
  }
];

export const GM_TOOLBAR_NAV_ITEMS: ReadonlyArray<GMToolbarNavItem> = GM_TOOLBAR_NAV_GROUPS.flatMap(
  (group) => group.items
);
