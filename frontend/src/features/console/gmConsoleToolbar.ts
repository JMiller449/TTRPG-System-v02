import type { GMView } from "@/app/state/types";
import type { EncounterPreset } from "@/domain/models";

export const GM_TOOLBAR_NAV_ITEMS: ReadonlyArray<{ view: GMView; label: string }> = [
  { view: "console", label: "GM Console" },
  { view: "sheet_viewer", label: "Sheet Viewer" },
  { view: "template_library", label: "Template Library" },
  { view: "create_template", label: "Create Template" },
  { view: "encounter_presets", label: "Encounter Presets" },
  { view: "xp_tracker", label: "XP Tracker" },
  { view: "item_maker", label: "Item Maker" },
  { view: "formula_authoring", label: "Formula Authoring" },
  { view: "proficiency_authoring", label: "Proficiency Authoring" },
  { view: "condition_authoring", label: "Condition Authoring" },
  { view: "action_authoring", label: "Action Authoring" }
];

export function orderedEncounterPresets(
  encounters: Record<string, EncounterPreset>,
  encounterOrder: string[]
): EncounterPreset[] {
  return encounterOrder
    .map((id) => encounters[id])
    .filter((encounter): encounter is EncounterPreset => Boolean(encounter));
}
