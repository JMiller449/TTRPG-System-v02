import type { GMView } from "@/app/state/types";
import type { Role } from "@/domain/models";
import type { ActionAuthoringSection } from "@/features/actions/actionAuthoringSections";
import type { ItemAuthoringSection } from "@/features/items/itemAuthoringSections";
import type { PlayerSheetTab } from "@/features/sheets/sheetDisplay";

export type ConsoleView = GMView;

export interface ConsoleSidebarNavItem {
  view: ConsoleView;
  label: string;
  glyph: string;
  roles: readonly Role[];
  children?: readonly ConsoleSidebarChildItem[];
}

export interface ConsoleSidebarCharacterItem {
  owner: "characters";
  section: PlayerSheetTab;
  label: string;
  roles: readonly Role[];
}

export interface ConsoleSidebarActionItem {
  owner: "actions";
  section: ActionAuthoringSection;
  label: string;
  roles: readonly Role[];
}

export interface ConsoleSidebarItemItem {
  owner: "items";
  section: ItemAuthoringSection;
  label: string;
  roles: readonly Role[];
}

export type ConsoleSidebarChildItem =
  | ConsoleSidebarCharacterItem
  | ConsoleSidebarActionItem
  | ConsoleSidebarItemItem;

export interface ConsoleSidebarNavGroup {
  label: string;
  items: readonly ConsoleSidebarNavItem[];
}

const BOTH_ROLES = ["player", "gm"] as const satisfies readonly Role[];
const GM_ONLY = ["gm"] as const satisfies readonly Role[];

export const CHARACTER_SIDEBAR_ITEMS: readonly ConsoleSidebarCharacterItem[] = [
  { owner: "characters", section: "dense", label: "Dense", roles: BOTH_ROLES },
  { owner: "characters", section: "stats", label: "Stats", roles: BOTH_ROLES },
  { owner: "characters", section: "statuses", label: "Statuses", roles: BOTH_ROLES },
  { owner: "characters", section: "actions", label: "Actions", roles: BOTH_ROLES },
  { owner: "characters", section: "inventory", label: "Inventory", roles: BOTH_ROLES },
  { owner: "characters", section: "resistances", label: "Resistances", roles: BOTH_ROLES },
  { owner: "characters", section: "attributes", label: "Attributes", roles: BOTH_ROLES },
  { owner: "characters", section: "proficiencies", label: "Proficiencies", roles: BOTH_ROLES },
  { owner: "characters", section: "kills", label: "Kills", roles: BOTH_ROLES },
  { owner: "characters", section: "backstory", label: "Backstory", roles: BOTH_ROLES },
  { owner: "characters", section: "notes", label: "Notes", roles: BOTH_ROLES },
  { owner: "characters", section: "action_history", label: "Action History", roles: GM_ONLY },
  { owner: "characters", section: "management", label: "Management", roles: GM_ONLY },
  {
    owner: "characters",
    section: "organize_sheets",
    label: "Organize Sheets",
    roles: GM_ONLY
  }
];

export const ACTION_SIDEBAR_ITEMS: readonly ConsoleSidebarActionItem[] = [
  { owner: "actions", section: "catalog", label: "Catalog", roles: GM_ONLY },
  { owner: "actions", section: "guided", label: "Guided", roles: GM_ONLY }
];

export const ITEM_SIDEBAR_ITEMS: readonly ConsoleSidebarItemItem[] = [
  { owner: "items", section: "catalog", label: "Catalog", roles: GM_ONLY },
  { owner: "items", section: "wizard", label: "Wizard", roles: GM_ONLY }
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
      {
        view: "action_authoring",
        label: "Actions",
        glyph: "AC",
        roles: GM_ONLY,
        children: ACTION_SIDEBAR_ITEMS
      },
      {
        view: "item_maker",
        label: "Items",
        glyph: "IT",
        roles: GM_ONLY,
        children: ITEM_SIDEBAR_ITEMS
      }
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
