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

export interface FormulaDefinition {
  id: string;
  formula: Formula;
}

export interface SendMessageActionStep {
  step_id: string;
  message: Formula;
  type: "send_message";
}

export interface SetValueActionStep {
  step_id: string;
  path: string[];
  value: Formula;
  target?: "caster" | "target";
  min_value?: Formula | null;
  max_value?: Formula | null;
  on_min_violation?: "clamp" | "reject";
  on_max_violation?: "clamp" | "reject";
  type: "set_value";
}

interface BoundedActionStep {
  step_id: string;
  path: string[];
  amount: Formula;
  target?: "caster" | "target";
  min_value?: Formula | null;
  max_value?: Formula | null;
  on_min_violation?: "clamp" | "reject";
  on_max_violation?: "clamp" | "reject";
}

export interface IncrementValueActionStep extends BoundedActionStep {
  type: "increment_value";
}

export interface DecrementValueActionStep extends BoundedActionStep {
  type: "decrement_value";
}

export type DamageType =
  | "Arcane"
  | "Slashing"
  | "Bludgeoning"
  | "Piercing"
  | "Fire"
  | "Water"
  | "Earth"
  | "Wind"
  | "Light"
  | "Dark"
  | "Lightning"
  | "Ice"
  | "Time"
  | "Gravity"
  | "Psychic";

export interface ResolveDamageActionStep {
  step_id: string;
  damage_type: DamageType;
  amount: Formula;
  target?: "caster" | "target";
  type: "resolve_damage";
}

export interface GainProficiencyUseActionStep {
  step_id: string;
  proficiency_id: string;
  amount: Formula;
  target?: "caster" | "target";
  type: "gain_proficiency_use";
}

export interface ApplyAugmentationActionStep {
  step_id: string;
  augmentation_id: string;
  operation?: "apply" | "remove";
  target?: "caster" | "target";
  type: "apply_augmentation";
}

export interface ApplyConditionPresetActionStep {
  step_id: string;
  condition_id: string;
  operation?: "apply" | "remove";
  target?: "caster" | "target";
  type: "apply_condition_preset";
}

export type ActionStep =
  | SendMessageActionStep
  | SetValueActionStep
  | IncrementValueActionStep
  | DecrementValueActionStep
  | ResolveDamageActionStep
  | GainProficiencyUseActionStep
  | ApplyAugmentationActionStep
  | ApplyConditionPresetActionStep;

export interface ActionDefinition {
  id: string;
  name: string;
  notes?: string;
  steps?: ActionStep[];
}

export interface StatAugmentation {
  stat_name: string;
  augmentation: Formula;
}

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  price: string;
  weight: string;
  stat_augmentations: StatAugmentation[];
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
  notes?: string;
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
  notes?: string;
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
