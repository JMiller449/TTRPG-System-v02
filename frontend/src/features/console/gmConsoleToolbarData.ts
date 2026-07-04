import type { GMView } from "@/app/state/types";

export interface GMToolbarNavItem {
  view: GMView;
  label: string;
}

export interface GMToolbarNavGroup {
  label: string;
  items: readonly GMToolbarNavItem[];
}

export const GM_TOOLBAR_NAV_GROUPS: readonly GMToolbarNavGroup[] = [
  {
    label: "Session",
    items: [
      { view: "console", label: "Dashboard" },
      { view: "sheet_viewer", label: "Characters" }
    ]
  },
  {
    label: "Templates",
    items: [
      { view: "template_library", label: "Library" },
      { view: "create_template", label: "Builder" }
    ]
  },
  {
    label: "Content",
    items: [
      { view: "action_authoring", label: "Actions" },
      { view: "item_maker", label: "Items" }
    ]
  },
  {
    label: "Rules Data",
    items: [
      { view: "fact_authoring", label: "Facts" },
      { view: "formula_authoring", label: "Formulas" },
      { view: "proficiency_authoring", label: "Proficiencies" }
    ]
  },
  {
    label: "Status Effects",
    items: [
      { view: "condition_authoring", label: "Conditions" },
      { view: "effect_authoring", label: "Standalone Effects" }
    ]
  },
  {
    label: "Encounters",
    items: [
      { view: "encounter_presets", label: "Presets" },
      { view: "xp_tracker", label: "XP" }
    ]
  },
  {
    label: "Admin",
    items: [{ view: "state_backup", label: "Backup & Undo" }]
  }
];

export const GM_TOOLBAR_NAV_ITEMS: ReadonlyArray<GMToolbarNavItem> =
  GM_TOOLBAR_NAV_GROUPS.flatMap((group) => group.items);
