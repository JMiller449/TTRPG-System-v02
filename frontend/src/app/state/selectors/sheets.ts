import type { AppState } from "@/app/state/types";
import type {
  PersistentSheet,
  Sheet,
  SheetInstanceView,
  SheetInventoryItem,
  SheetKind,
  SheetTemplateView
} from "@/domain/models";
import type { SheetStatKey } from "@/domain/stats";

export interface ActiveSheetDetail {
  instance: SheetInstanceView;
  sheet: Sheet | null;
  persistentSheet: PersistentSheet;
  baseStats: Partial<Record<SheetStatKey, number>>;
  stats: Partial<Record<SheetStatKey, number>>;
}

function getSheetKind(state: AppState, sheet: Sheet | null): SheetKind {
  const { serverState } = state;
  if (!sheet) {
    return "player";
  }
  return serverState.sheetPresentation[sheet.id]?.kind ?? (sheet.dm_only ? "enemy" : "player");
}

function readFormulaNumber(text: string): number {
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildBaseStatValues(
  sheet: Sheet | null,
  persistentSheet?: PersistentSheet | null
): Partial<Record<SheetStatKey, number>> {
  if (!sheet) {
    return {};
  }

  return {
    strength: sheet.stats.strength,
    dexterity: sheet.stats.dexterity,
    constitution: sheet.stats.constitution,
    perception: sheet.stats.perception,
    arcane: sheet.stats.arcane,
    will: sheet.stats.will,
    lifting: readFormulaNumber(sheet.stats.lifting.text),
    carry_weight: readFormulaNumber(sheet.stats.carry_weight.text),
    acrobatics: readFormulaNumber(sheet.stats.acrobatics.text),
    stamina: readFormulaNumber(sheet.stats.stamina.text),
    reaction_time: readFormulaNumber(sheet.stats.reaction_time.text),
    health: persistentSheet?.health ?? readFormulaNumber(sheet.stats.health.text),
    endurance: readFormulaNumber(sheet.stats.endurance.text),
    pain_tolerance: readFormulaNumber(sheet.stats.pain_tolerance.text),
    sight_distance: readFormulaNumber(sheet.stats.sight_distance.text),
    intuition: readFormulaNumber(sheet.stats.intuition.text),
    registration: readFormulaNumber(sheet.stats.registration.text),
    mana: persistentSheet?.mana ?? readFormulaNumber(sheet.stats.mana.text),
    control: readFormulaNumber(sheet.stats.control.text),
    sensitivity: readFormulaNumber(sheet.stats.sensitivity.text),
    charisma: readFormulaNumber(sheet.stats.charisma.text),
    mental_fortitude: readFormulaNumber(sheet.stats.mental_fortitude.text),
    courage: readFormulaNumber(sheet.stats.courage.text)
  };
}

export function selectSheetTemplateView(state: AppState, sheetId: string): SheetTemplateView | null {
  const { serverState } = state;
  const sheet = serverState.sheets[sheetId];
  if (!sheet) {
    return null;
  }

  const presentation = serverState.sheetPresentation[sheet.id];
  return {
    id: sheet.id,
    sheet,
    kind: getSheetKind(state, sheet),
    name: sheet.name,
    notes: presentation?.notes ?? "",
    stats: buildBaseStatValues(sheet),
    tags: presentation?.tags ?? [],
    updatedAt: presentation?.updatedAt ?? ""
  };
}

export function selectSheetTemplateViews(state: AppState): SheetTemplateView[] {
  return state.serverState.sheetOrder
    .map((id) => selectSheetTemplateView(state, id))
    .filter((entry): entry is SheetTemplateView => Boolean(entry));
}

export function selectSheetInstanceView(state: AppState, persistentSheetId: string): SheetInstanceView | null {
  const { serverState } = state;
  const persistentSheet = serverState.persistentSheets[persistentSheetId];
  if (!persistentSheet) {
    return null;
  }

  const sheet = serverState.sheets[persistentSheet.parent_id] ?? null;
  const sheetPresentation = sheet ? serverState.sheetPresentation[sheet.id] : undefined;
  const persistentPresentation = serverState.persistentSheetPresentation[persistentSheetId];

  return {
    id: persistentSheetId,
    persistentSheet,
    parentSheet: sheet,
    kind: getSheetKind(state, sheet),
    name: persistentPresentation?.name ?? sheet?.name ?? persistentSheetId,
    notes: sheetPresentation?.notes ?? "",
    updatedAt: persistentPresentation?.updatedAt ?? sheetPresentation?.updatedAt ?? ""
  };
}

export function selectActiveSheetDetail(state: AppState): ActiveSheetDetail | null {
  const { serverState, uiState } = state;
  if (!uiState.activeSheetId) {
    return null;
  }

  const instance = selectSheetInstanceView(state, uiState.activeSheetId);
  if (!instance) {
    return null;
  }

  const baseStats = buildBaseStatValues(instance.parentSheet, instance.persistentSheet);
  const statOverrides = uiState.localSheetStatOverrides[instance.id] ?? {};

  return {
    instance,
    sheet: instance.parentSheet,
    persistentSheet: instance.persistentSheet,
    baseStats,
    stats: {
      ...baseStats,
      ...statOverrides
    }
  };
}

export function selectSheetEquipment(state: AppState, sheetId: string): SheetInventoryItem[] {
  return state.uiState.localSheetEquipment[sheetId] ?? [];
}

export function selectActiveWeaponEntryId(state: AppState, sheetId: string): string | null {
  return state.uiState.localSheetActiveWeapon[sheetId] ?? null;
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

  return state.uiState.itemTemplates[activeEntry.itemTemplateId]?.name ?? "None";
}

export function selectPlayerInstances(state: AppState): SheetInstanceView[] {
  return state.serverState.persistentSheetOrder
    .map((id) => selectSheetInstanceView(state, id))
    .filter((entry): entry is SheetInstanceView => Boolean(entry))
    .filter((entry) => entry.kind === "player");
}
