import type { ClientIntent } from "@/domain/ipc";
import type { Sheet, SheetPresentation } from "@/domain/models";
import { makeId } from "@/shared/utils/id";

export function buildCreateSheetIntent(sheet: Sheet, presentation?: SheetPresentation): ClientIntent {
  return {
    intentId: makeId("intent"),
    type: "create_sheet",
    payload: { sheet, presentation }
  };
}

export function buildUpdateSheetIntent(
  sheetId: string,
  changes: Partial<Sheet>,
  presentation?: Partial<SheetPresentation>
): ClientIntent {
  return {
    intentId: makeId("intent"),
    type: "update_sheet",
    payload: { sheetId, changes, presentation }
  };
}

export function buildInstantiateSheetIntent(sheetId: string, count: number): ClientIntent {
  return {
    intentId: makeId("intent"),
    type: "instantiate_sheet",
    payload: { sheetId, count: Math.max(1, count) }
  };
}
