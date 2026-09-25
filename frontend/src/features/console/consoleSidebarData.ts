import type { GMView } from "@/app/state/types";
import type { Role } from "@/domain/models";
import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";

export type ConsoleView = GMView;

export interface ConsoleSidebarNavItem {
  view: ConsoleView;
  label: string;
  glyph: string;
  roles: readonly Role[];
  children?: readonly ConsoleSidebarCharacterItem[];
}

export interface ConsoleSidebarCharacterItem {
  section: PlayerSheetTab;
  label: string;
  roles: readonly Role[];
}

export interface ConsoleSidebarNavGroup {
  label: string;
  items: readonly ConsoleSidebarNavItem[];
}

const BOTH_ROLES = ["player", "gm"] as const satisfies readonly Role[];
const GM_ONLY = ["gm"] as const satisfies readonly Role[];

export const CHARACTER_SIDEBAR_ITEMS: readonly ConsoleSidebarCharacterItem[] = [
  { section: "dense", label: "Dense", roles: BOTH_ROLES },
  { section: "stats", label: "Stats", roles: BOTH_ROLES },
  { section: "statuses", label: "Statuses", roles: BOTH_ROLES },
  { section: "actions", label: "Actions", roles: BOTH_ROLES },
  { section: "inventory", label: "Inventory", roles: BOTH_ROLES },
  { section: "resistances", label: "Resistances", roles: BOTH_ROLES },
  { section: "attributes", label: "Attributes", roles: BOTH_ROLES },
  { section: "proficiencies", label: "Proficiencies", roles: BOTH_ROLES },
  { section: "kills", label: "Kills", roles: BOTH_ROLES },
  { section: "backstory", label: "Backstory", roles: BOTH_ROLES },
  { section: "notes", label: "Notes", roles: BOTH_ROLES },
  { section: "action_history", label: "Action History", roles: GM_ONLY },
  { section: "management", label: "Management", roles: GM_ONLY },
  { section: "organize_sheets", label: "Organize Sheets", roles: GM_ONLY }
];

export const CONSOLE_SIDEBAR_NAV_GROUPS: readonly ConsoleSidebarNavGroup[] = [
  {
    label: "Session",
    items: [
      {
        view: "sheet_viewer",
        label: "Characters",
        glyph: "CH",
        roles: BOTH_ROLES,
        children: CHARACTER_SIDEBAR_ITEMS
      },
      { view: "action_history", label: "Action History", glyph: "AH", roles: GM_ONLY }
    ]
  },
  {
    label: "Templates",
    items: [
      { view: "template_library", label: "Library", glyph: "LB", roles: GM_ONLY },
      { view: "create_template", label: "Builder", glyph: "BD", roles: GM_ONLY }
    ]
  },
  {
    label: "Content",
    items: [
      { view: "action_authoring", label: "Actions", glyph: "AC", roles: GM_ONLY },
      { view: "item_maker", label: "Items", glyph: "IT", roles: GM_ONLY },
      { view: "item_template_builder", label: "Item Templates", glyph: "TM", roles: GM_ONLY }
    ]
  },
  {
    label: "Rules Data",
    items: [
      { view: "attribute_authoring", label: "Attributes", glyph: "AT", roles: GM_ONLY },
      { view: "formula_authoring", label: "Formulas", glyph: "FX", roles: GM_ONLY },
      { view: "proficiency_authoring", label: "Proficiencies", glyph: "PF", roles: GM_ONLY },
      { view: "tag_authoring", label: "Tags", glyph: "TG", roles: GM_ONLY }
    ]
  },
  {
    label: "Status Effects",
    items: [
      { view: "condition_authoring", label: "Conditions", glyph: "CD", roles: GM_ONLY },
      { view: "effect_authoring", label: "Effects", glyph: "EF", roles: GM_ONLY }
    ]
  },
  {
    label: "Encounters",
    items: [
      { view: "encounter_presets", label: "Presets", glyph: "EN", roles: GM_ONLY },
      { view: "xp_tracker", label: "XP", glyph: "XP", roles: GM_ONLY }
    ]
  },
  {
    label: "Admin",
    items: [
      { view: "state_backup", label: "Backup & Undo", glyph: "BK", roles: GM_ONLY },
      { view: "extension", label: "Extension", glyph: "EX", roles: BOTH_ROLES }
    ]
  }
];

export const CONSOLE_SIDEBAR_NAV_ITEMS: ReadonlyArray<ConsoleSidebarNavItem> =
  CONSOLE_SIDEBAR_NAV_GROUPS.flatMap((group) => group.items);

export function getConsoleSidebarNavGroups(role: Role): ConsoleSidebarNavGroup[] {
  return CONSOLE_SIDEBAR_NAV_GROUPS.flatMap((group) => {
    const items = group.items
      .filter((item) => item.roles.includes(role))
      .map((item) => ({
        ...item,
        children: item.children?.filter((child) => child.roles.includes(role))
      }));
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}
