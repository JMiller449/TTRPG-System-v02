import type { ClientIntent } from "@/domain/ipc";
import type { SheetTemplate } from "@/domain/models";
import { makeId } from "@/shared/utils/id";

export function buildCreateTemplateIntent(template: SheetTemplate): ClientIntent {
  return {
    intentId: makeId("intent"),
    type: "create_template",
    payload: { template }
  };
}

export function buildUpdateTemplateIntent(templateId: string, changes: Partial<SheetTemplate>): ClientIntent {
  return {
    intentId: makeId("intent"),
    type: "update_template",
    payload: { templateId, changes }
  };
}

export function buildInstantiateTemplateIntent(templateId: string, count: number): ClientIntent {
  return {
    intentId: makeId("intent"),
    type: "instantiate_template",
    payload: { templateId, count: Math.max(1, count) }
  };
}

export function buildSetActiveSheetIntent(sheetId: string | null): ClientIntent {
  return {
    intentId: makeId("intent"),
    type: "set_active_sheet",
    payload: { sheetId }
  };
}
