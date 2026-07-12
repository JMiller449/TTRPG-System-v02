import type { AttributeBridge, Formula, SheetKind, SheetSlayedBridge } from "@/domain/models";
import type {
  ResistancePercentDraft,
  SheetFormulaStatName
} from "@/features/sheets/sheetDefinitionEditing";

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
  racialHpMultiplier: string;
  maxHealth: Formula;
  maxMana: Formula;
  coreStats: Record<CoreTemplateStatKey, string>;
  formulaStats: Record<SheetFormulaStatName, Formula>;
  attributes: Record<string, AttributeBridge>;
  resistances: ResistancePercentDraft;
  actions: TemplateActionAssignment[];
  proficiencies: TemplateProficiencyAssignment[];
  items: TemplateItemAssignment[];
  slayedRecord: Record<string, SheetSlayedBridge>;
}

export interface TemplateActionAssignment {
  relationshipId: string;
  actionId: string;
}

export interface TemplateProficiencyAssignment {
  relationshipId: string;
  proficiencyId: string;
  useCount: string;
  growthRate: string;
}

export interface TemplateItemAssignment {
  relationshipId: string;
  itemId: string;
  count: string;
  equipped: boolean;
}

export type TemplateEditorSection =
  | "details"
  | "stats"
  | "attributes"
  | "resistances"
  | "actions"
  | "proficiencies"
  | "inventory";

export type TemplateEditorErrors = Record<TemplateEditorSection, string[]>;
