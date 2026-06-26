import type { SheetKind } from "@/domain/models";

export type CoreTemplateStatKey =
  | "strength"
  | "dexterity"
  | "constitution"
  | "perception"
  | "arcane"
  | "will";

export const CORE_TEMPLATE_STATS: readonly CoreTemplateStatKey[] = [
  "strength",
  "dexterity",
  "constitution",
  "perception",
  "arcane",
  "will"
];

export const CORE_STAT_LABELS: Record<CoreTemplateStatKey, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
  constitution: "Constitution",
  perception: "Perception",
  arcane: "Arcane",
  will: "Will"
};

export interface TemplateEditorValues {
  kind: SheetKind;
  name: string;
  notes: string;
  xpGivenWhenSlayed: string;
  xpCap: string;
  coreStats: Record<CoreTemplateStatKey, string>;
}
