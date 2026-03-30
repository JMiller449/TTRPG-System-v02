import type { Sheet, SheetKind, SheetPresentation, Stats } from "@/domain/models";
import {
  CORE_TEMPLATE_STATS,
  type CoreTemplateStatKey,
  type TemplateEditorValues
} from "@/features/sheets/TemplateEditorForm";

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
    tags: kind,
    coreStats: CORE_TEMPLATE_STATS.reduce(
      (acc, key) => ({ ...acc, [key]: "" }),
      {} as TemplateEditorValues["coreStats"]
    )
  };
}

export function parseTemplateTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
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
    notes: presentation?.notes ?? "",
    tags: (presentation?.tags ?? []).join(", ")
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
    tags: parseTemplateTags(values.tags),
    updatedAt: new Date().toISOString()
  };
}
