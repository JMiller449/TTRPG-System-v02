export type Role = "player" | "gm";

export type SheetKind = "player" | "enemy";

export type StatKey =
  | "strength"
  | "dexterity"
  | "constitution"
  | "perception"
  | "arcane"
  | "will"
  | "lifting"
  | "carry_weight"
  | "acrobatics"
  | "stamina"
  | "reaction_time"
  | "health"
  | "endurance"
  | "pain_tolerance"
  | "sight_distance"
  | "intuition"
  | "registration"
  | "mana"
  | "control"
  | "sensitivity"
  | "charisma"
  | "mental_fortitude"
  | "courage";

export interface FormulaAlias {
  name: string;
  path: string[];
}

export interface Formula {
  aliases: FormulaAlias[] | null;
  text: string;
}

export interface Bridge {
  relationship_id: string;
  entry_id: string;
}

export interface ItemBridge {
  relationship_id: string;
  count: number;
  active: boolean;
  item_id: string;
}

export interface ProficiencyBridge {
  relationship_id: string;
  prof_id: string;
  use_count: number;
  growth_rate: number;
}

export interface SheetSlayedBridge {
  sheet_id: string;
  count: number;
}

export interface Stats {
  strength: number;
  dexterity: number;
  constitution: number;
  perception: number;
  arcane: number;
  will: number;
  lifting: Formula;
  carry_weight: Formula;
  acrobatics: Formula;
  stamina: Formula;
  reaction_time: Formula;
  health: Formula;
  endurance: Formula;
  pain_tolerance: Formula;
  sight_distance: Formula;
  intuition: Formula;
  registration: Formula;
  mana: Formula;
  control: Formula;
  sensitivity: Formula;
  charisma: Formula;
  mental_fortitude: Formula;
  courage: Formula;
}

export interface Sheet {
  id: string;
  name: string;
  dm_only: boolean;
  xp_given_when_slayed: number;
  xp_cap: string;
  proficiencies: Record<string, ProficiencyBridge>;
  items: Record<string, ItemBridge>;
  stats: Stats;
  slayed_record: Record<string, SheetSlayedBridge>;
  actions: Record<string, Bridge>;
}

export interface PersistentSheet {
  parent_id: string;
  health: number;
  mana: number;
  augments: Record<string, Bridge>;
}

export interface CombatSheet {
  parent_id: string;
  active: boolean;
  action_count: number;
  initiative: number;
}

export interface PersistentSheetRecord {
  id: string;
  value: PersistentSheet;
}

export interface CombatSheetRecord {
  id: string;
  value: CombatSheet;
}

export interface SheetPresentation {
  kind: SheetKind;
  notes: string;
  tags: string[];
  updatedAt: string;
}

export interface PersistentSheetPresentation {
  name?: string;
  updatedAt: string;
}

export interface SheetPresentationRecord {
  sheetId: string;
  value: SheetPresentation;
}

export interface PersistentSheetPresentationRecord {
  persistentSheetId: string;
  value: PersistentSheetPresentation;
}

export interface SheetTemplateView {
  id: string;
  sheet: Sheet;
  kind: SheetKind;
  name: string;
  notes: string;
  stats: Partial<Record<StatKey, number>>;
  tags: string[];
  updatedAt: string;
}

export interface SheetInstanceView {
  id: string;
  persistentSheet: PersistentSheet;
  parentSheet: Sheet | null;
  kind: SheetKind;
  name: string;
  notes: string;
  updatedAt: string;
}

export interface EncounterEntry {
  templateId: string;
  count: number;
}

export interface EncounterPreset {
  id: string;
  name: string;
  entries: EncounterEntry[];
  updatedAt: string;
}

export interface ItemTemplate {
  id: string;
  name: string;
  type: string;
  rank: string;
  weight: string;
  value: string;
  immediateEffects: string;
  nonImmediateEffects: string;
  updatedAt: string;
}

export interface SheetInventoryItem {
  id: string;
  itemTemplateId: string;
}

export type RollVisibility = "visible" | "hidden";

export type CommonDieSides = 4 | 6 | 8 | 10 | 12 | 20 | 100;

export interface StatRollRequest {
  kind: "stat";
  sheetId: string;
  stat: StatKey;
  visibility: RollVisibility;
}

export interface DiceRollRequest {
  kind: "dice";
  sheetId: string;
  count: number;
  sides: CommonDieSides;
  visibility: RollVisibility;
}

export type RollRequest = StatRollRequest | DiceRollRequest;

export type RollStatus = "pending" | "resolved" | "failed";

export interface RollLogEntry {
  id: string;
  status: RollStatus;
  request: RollRequest;
  createdAt: string;
  requestedByRole: Role;
  resultText?: string;
  error?: string;
}
