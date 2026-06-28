import type { FormulaAlias, Resistances } from "@/domain/models";
import { CORE_SUBSTAT_GROUPS } from "@/domain/stats";
import type { VariablePickerEntry } from "@/features/variables/variablePicker";
import type {
  SheetFormulaStatName,
  SheetResistancesPayload
} from "@/infrastructure/ws/requestBuilders";

export const FORMULA_STAT_KEYS = CORE_SUBSTAT_GROUPS.flatMap((group) => [
  ...group.subs
]) as SheetFormulaStatName[];

export const RESISTANCE_FIELDS = [
  ["resistance", "Total"],
  ["physical", "Physical"],
  ["magical", "Magical"],
  ["slashing", "Slashing"],
  ["bludgeoning", "Bludgeoning"],
  ["piercing", "Piercing"],
  ["arcane", "Arcane"],
  ["fire", "Fire"],
  ["water", "Water"],
  ["earth", "Earth"],
  ["wind", "Wind"],
  ["light", "Light"],
  ["dark", "Dark"],
  ["lightning", "Lightning"],
  ["ice", "Ice"],
  ["time", "Time"],
  ["gravity", "Gravity"],
  ["psychic", "Psychic"]
] as const;

export type ResistanceKey = (typeof RESISTANCE_FIELDS)[number][0];
export type ResistancePercentDraft = Record<ResistanceKey, string>;

export function toResistancePercentDraft(
  resistances: Resistances | undefined
): ResistancePercentDraft {
  return Object.fromEntries(
    RESISTANCE_FIELDS.map(([key]) => [
      key,
      String(Number(((resistances?.[key] ?? 0) * 100).toFixed(4)))
    ])
  ) as ResistancePercentDraft;
}

export function parseResistancePercentDraft(
  draft: ResistancePercentDraft
): SheetResistancesPayload | null {
  const entries = RESISTANCE_FIELDS.map(([key]) => {
    const percent = Number(draft[key]);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return null;
    }
    return [key, percent / 100] as const;
  });
  if (entries.some((entry) => entry === null)) {
    return null;
  }
  return Object.fromEntries(entries as Array<readonly [ResistanceKey, number]>);
}

export function toSheetRelativeFormulaAlias(entry: VariablePickerEntry): FormulaAlias | null {
  if (entry.root !== "sheet") {
    return null;
  }
  return {
    name: entry.alias.name,
    path: [...entry.path]
  };
}
