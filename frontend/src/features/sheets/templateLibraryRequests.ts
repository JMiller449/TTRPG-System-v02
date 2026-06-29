import type { SheetTemplateView } from "@/domain/models";
import { buildDeleteSheetRequest } from "@/infrastructure/ws/requestBuilders";

export function buildDeleteTemplateSubmission(template: Pick<SheetTemplateView, "id" | "name">) {
  return {
    request: buildDeleteSheetRequest({ sheetId: template.id }),
    label: `Delete template: ${template.name}`,
    confirmation:
      `Delete template "${template.name}" (${template.id})? ` +
      "This cannot be undone. Templates referenced by instances or encounter presets must be unlinked first."
  };
}
