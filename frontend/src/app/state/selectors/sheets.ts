import type { AppState } from "@/app/state/types";
import type { SheetInstance, SheetInventoryItem, SheetTemplate } from "@/domain/models";
import type { SheetStatKey } from "@/domain/stats";

export interface ActiveSheetDetail {
  instance: SheetInstance;
  template: SheetTemplate | null;
  stats: Partial<Record<SheetStatKey, number>>;
}

export function selectActiveSheetDetail(state: AppState): ActiveSheetDetail | null {
  if (!state.activeSheetId) {
    return null;
  }

  const instance = state.instances[state.activeSheetId];
  if (!instance) {
    return null;
  }

  const template = state.templates[instance.templateId] ?? null;
  const baseStats = template?.stats ?? {};
  const statOverrides = state.localSheetStatOverrides[instance.id] ?? {};

  return {
    instance,
    template,
    stats: {
      ...baseStats,
      ...statOverrides
    }
  };
}

export function selectSheetEquipment(state: AppState, sheetId: string): SheetInventoryItem[] {
  return state.localSheetEquipment[sheetId] ?? [];
}

export function selectActiveWeaponEntryId(state: AppState, sheetId: string): string | null {
  return state.localSheetActiveWeapon[sheetId] ?? null;
}

export function selectActiveWeaponLabel(state: AppState, sheetId: string): string {
  const activeWeaponEntryId = selectActiveWeaponEntryId(state, sheetId);
  if (!activeWeaponEntryId) {
    return "None";
  }

  const equipment = selectSheetEquipment(state, sheetId);
  const activeEntry = equipment.find((entry) => entry.id === activeWeaponEntryId);
  if (!activeEntry) {
    return "None";
  }

  return state.itemTemplates[activeEntry.itemTemplateId]?.name ?? "None";
}

export function selectPlayerInstances(state: AppState): SheetInstance[] {
  return state.instanceOrder
    .map((id) => state.instances[id])
    .filter((entry): entry is SheetInstance => Boolean(entry) && entry.kind === "player");
}
