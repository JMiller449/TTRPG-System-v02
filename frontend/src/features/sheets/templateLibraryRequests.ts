import type { SheetTemplateView } from "@/domain/models";
import { buildDeleteSheetRequest } from "@/infrastructure/ws/requestBuilders";

export function buildDeleteTemplateSubmission(template: Pick<SheetTemplateView, "id" | "name">) {
  return {
    request: buildDeleteSheetRequest({ sheetId: template.id }),
    label: `Delete template: ${template.name}`,
    confirmation:
      `Delete template "${template.name}" (${template.id})? ` +
      "This cannot be undone. Spawned instances must be despawned first. " +
      "Encounter entries using this template will be removed, and presets left empty will be deleted."
  };
}
