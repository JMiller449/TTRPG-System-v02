import type { GMView } from "@/app/state/types";

export const GM_NAV_ITEMS: ReadonlyArray<{ view: GMView; label: string }> = [
  { view: "console", label: "GM Console" },
  { view: "sheet_viewer", label: "Sheet Viewer" },
  { view: "template_library", label: "Template Library" },
  { view: "create_template", label: "Create Template" },
  { view: "encounter_presets", label: "Encounter Presets" },
  { view: "item_maker", label: "Item Maker" },
  { view: "formula_authoring", label: "Formula Authoring" },
  { view: "proficiency_authoring", label: "Proficiency Authoring" },
  { view: "condition_authoring", label: "Condition Authoring" },
  { view: "action_authoring", label: "Action Authoring" },
  { view: "state_backup", label: "State Backup" }
];

export function isGMOverlayShortcut(event: Pick<KeyboardEvent, "altKey" | "key">): boolean {
  return event.altKey && event.key.toLowerCase() === "g";
}
