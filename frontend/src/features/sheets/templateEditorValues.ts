import type { Sheet, SheetKind, SheetPresentation, Stats } from "@/domain/models";
import {
  CORE_TEMPLATE_STATS,
  type CoreTemplateStatKey,
  type TemplateEditorValues
} from "@/features/sheets/templateEditorTypes";
import type { SheetDefinitionPayload } from "@/infrastructure/ws/requestBuilders";

export interface InstancedSheetCreationValues {
  instanceId: string;
  parentSheetId: string;
  health: number;
  mana: number;
  notes: string;
  generateAccessCode: boolean;
}

function createFormula(text = "0") {
  return {
    aliases: null,
    text
  };
}

export function createDefaultStats(): Stats {
  return {
    strength: 0,
    dexterity: 0,
    constitution: 0,
    perception: 0,
    arcane: 0,
    will: 0,
    lifting: createFormula(),
    carry_weight: createFormula(),
    acrobatics: createFormula(),
    stamina: createFormula(),
    reaction_time: createFormula(),
    health: createFormula(),
    endurance: createFormula(),
    pain_tolerance: createFormula(),
    sight_distance: createFormula(),
    intuition: createFormula(),
    registration: createFormula(),
    mana: createFormula(),
    control: createFormula(),
    sensitivity: createFormula(),
    charisma: createFormula(),
    mental_fortitude: createFormula(),
    courage: createFormula()
  };
}

export function createEmptyTemplateEditorValues(kind: SheetKind = "player"): TemplateEditorValues {
  return {
    kind,
    name: "",
    notes: "",
    coreStats: CORE_TEMPLATE_STATS.reduce(
      (acc, key) => ({ ...acc, [key]: "" }),
      {} as TemplateEditorValues["coreStats"]
    )
  };
}

export function parseTemplateCoreStats(
  values: TemplateEditorValues["coreStats"]
): Partial<Record<CoreTemplateStatKey, number>> {
  return Object.fromEntries(
    Object.entries(values)
      .filter((entry) => entry[1].trim() !== "")
      .map(([key, raw]) => [key, Number(raw)])
      .filter((entry) => Number.isFinite(entry[1]))
  ) as Partial<Record<CoreTemplateStatKey, number>>;
}

export function toTemplateEditorValues(
  sheet: Sheet,
  presentation?: SheetPresentation
): TemplateEditorValues {
  const base = createEmptyTemplateEditorValues(presentation?.kind ?? (sheet.dm_only ? "enemy" : "player"));
  CORE_TEMPLATE_STATS.forEach((key) => {
    base.coreStats[key] = String(sheet.stats[key] ?? "");
  });

  return {
    ...base,
    kind: presentation?.kind ?? (sheet.dm_only ? "enemy" : "player"),
    name: sheet.name,
    notes: presentation?.notes ?? sheet.notes ?? ""
  };
}

export function toSheetDefinitionPayload(values: TemplateEditorValues, sheetId: string): SheetDefinitionPayload {
  const coreStats = parseTemplateCoreStats(values.coreStats);
  return {
    id: sheetId,
    name: values.name.trim(),
    notes: values.notes.trim(),
    dm_only: values.kind === "enemy",
    xp_given_when_slayed: 0,
    xp_cap: "",
    proficiencies: {},
    items: {},
    stats: {
      ...createDefaultStats(),
      ...coreStats
    },
    slayed_record: {},
    actions: {}
  };
}

export function toUpdatedSheetDefinitionPayload(
  sheet: Sheet,
  values: TemplateEditorValues
): SheetDefinitionPayload {
  const coreStats = parseTemplateCoreStats(values.coreStats);
  return {
    ...sheet,
    name: values.name.trim(),
    notes: values.notes.trim(),
    dm_only: values.kind === "enemy",
    stats: {
      ...sheet.stats,
      ...coreStats
    }
  };
}

function parseFiniteFormulaNumber(text: string): number | null {
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIntegerFormulaNumber(text: string): number | null {
  const parsed = Number(text);
  return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed : null;
}

export function toInstancedSheetCreationValues(
  sheet: Sheet,
  kind: SheetKind,
  instanceId: string
): InstancedSheetCreationValues {
  return {
    instanceId,
    parentSheetId: sheet.id,
    health: parseFiniteFormulaNumber(sheet.stats.health.text) ?? sheet.stats.constitution,
    mana: parseIntegerFormulaNumber(sheet.stats.mana.text) ?? Math.trunc(sheet.stats.arcane),
    notes: "",
    generateAccessCode: kind === "player"
  };
}

export function toSheetChanges(values: TemplateEditorValues): Partial<Sheet> {
  const coreStats = parseTemplateCoreStats(values.coreStats);
  return {
    name: values.name.trim(),
    dm_only: values.kind === "enemy",
    stats: {
      ...createDefaultStats(),
      ...coreStats
    }
  };
}

export function toSheetPresentation(values: TemplateEditorValues): SheetPresentation {
  return {
    kind: values.kind,
    notes: values.notes.trim(),
    tags: [],
    updatedAt: new Date().toISOString()
  };
}
