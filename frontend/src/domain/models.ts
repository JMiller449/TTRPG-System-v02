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
  tags?: string[];
}

export interface FormulaDefinition {
  id: string;
  formula: Formula;
}

export type AttributeValue =
  | { type: "number"; value: number; formula?: null }
  | { type: "formula"; formula: Formula; value?: null }
  | { type: "boolean"; value: boolean; formula?: null }
  | { type: "text" | "enum" | "reference"; value: string; formula?: null }
  | { type: "list"; value: string[]; formula?: null };

export interface AttributeDefinition {
  id: string;
  name: string;
  description?: string;
  subject_types: Array<"sheet" | "item" | "action">;
  value_type: "number" | "boolean" | "text" | "enum" | "reference" | "list";
  default_value: AttributeValue;
  unit?: string;
  visibility?: "public" | "gm_only";
  validation_options?: string[];
  reference_kind?: string | null;
  required?: boolean;
  required_profile?: "weapon" | null;
  backend_owned?: boolean;
}

export interface AttributeBridge {
  relationship_id: string;
  attribute_id: string;
  value: AttributeValue;
  evaluated_value?: number | boolean | string | string[] | null;
  evaluation_error?: string | null;
}

export interface FormulaReference {
  formula_id: string;
  type: "formula_reference";
}

export interface CalculatedValueReference {
  variable_id: string;
  type: "calculated_value";
}

export type FormulaValueSource = Formula | FormulaReference;
export type NumericValueSource = FormulaValueSource | CalculatedValueReference;

export interface SendMessageActionStep {
  step_id: string;
  message: FormulaValueSource;
  type: "send_message";
}

export interface RollResult {
  label: string;
  value: FormulaValueSource;
}

export interface SendRollActionStep {
  step_id: string;
  title: string;
  presentation?: "simple" | "damage" | "default";
  rolls: RollResult[];
  type: "send_roll";
}

export interface CalculateValueActionStep {
  step_id: string;
  variable_id: string;
  value: FormulaValueSource;
  type: "calculate_value";
}

export interface SetValueActionStep {
  step_id: string;
  path: string[];
  value: NumericValueSource;
  target?: "caster" | "target";
  min_value?: NumericValueSource | null;
  max_value?: NumericValueSource | null;
  on_min_violation?: "clamp" | "reject";
  on_max_violation?: "clamp" | "reject";
  type: "set_value";
}

interface BoundedActionStep {
  step_id: string;
  path: string[];
  amount: NumericValueSource;
  target?: "caster" | "target";
  min_value?: NumericValueSource | null;
  max_value?: NumericValueSource | null;
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

export const DAMAGE_TYPES: readonly DamageType[] = [
  "Arcane",
  "Slashing",
  "Bludgeoning",
  "Piercing",
  "Fire",
  "Water",
  "Earth",
  "Wind",
  "Light",
  "Dark",
  "Lightning",
  "Ice",
  "Time",
  "Gravity",
  "Psychic"
];

export interface ResolveDamageActionStep {
  step_id: string;
  damage_type: DamageType;
  amount: NumericValueSource;
  target?: "caster" | "target";
  type: "resolve_damage";
}

export interface GainProficiencyUseActionStep {
  step_id: string;
  proficiency_id: string;
  amount: NumericValueSource;
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
  | SendRollActionStep
  | CalculateValueActionStep
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
  roll_mode_kind?: ActionRollModeKind;
  notes?: string;
  steps?: ActionStep[];
  attributes?: Record<string, AttributeBridge>;
}

export type ActionRollModeKind = "none" | "check" | "damage";

export type AugmentationSourceType =
  | "item"
  | "action"
  | "spell"
  | "condition"
  | "ally_effect"
  | "manual"
  | "other";

export type AugmentationScope = "sheet" | "instance";

export type AugmentationTargetRoot = "state" | "sheet" | "instance";

export type AugmentationOperation = "add" | "subtract" | "multiply" | "divide" | "set";

export type AugmentationEffectType =
  | "formula_modifier"
  | "evaluation_formula_modifier"
  | "roll_mode_modifier";

export type RollModeModifier = "advantage" | "disadvantage";

export interface AugmentationSource {
  type: AugmentationSourceType;
  id?: string | null;
  label?: string | null;
  relationship_id?: string | null;
  application_id?: string | null;
}

export interface AugmentationTarget {
  root: AugmentationTargetRoot;
  path: string[];
}

export interface FormulaModifierSelector {
  required_tags?: string[];
  excluded_tags?: string[];
  action_id?: string | null;
  formula_id?: string | null;
  step_id?: string | null;
  same_source_item?: boolean;
}

export interface FormulaModifierEffect {
  operation: AugmentationOperation;
  value: Formula;
  selector?: FormulaModifierSelector;
  type: "formula_modifier";
}

export interface EvaluationFormulaModifierEffect {
  operation: AugmentationOperation;
  value: Formula;
  selector?: FormulaModifierSelector;
  type: "evaluation_formula_modifier";
}

export interface RollModeModifierEffect {
  roll_mode: RollModeModifier;
  selector?: FormulaModifierSelector;
  type: "roll_mode_modifier";
}

export type AugmentationEffect =
  | FormulaModifierEffect
  | EvaluationFormulaModifierEffect
  | RollModeModifierEffect;

export type LifecycleMode =
  | "manual"
  | "rounds"
  | "turns"
  | "until_rest"
  | "until_source_removed"
  | "scene";

export interface AugmentationLifecycle {
  mode?: LifecycleMode;
  remaining?: number | null;
  expires_at?: string | null;
  remove_when_source_inactive?: boolean;
  notes?: string | null;
}

export interface Augmentation {
  id: string;
  name: string;
  description?: string;
  source: AugmentationSource;
  scope: AugmentationScope;
  target: AugmentationTarget;
  effect: AugmentationEffect;
  active?: boolean;
  applied?: boolean;
  applied_target_id?: string | null;
  lifecycle_owner?: "manual" | "equipment" | "condition" | "action";
  lifecycle?: AugmentationLifecycle;
}

export type StackingMode = "unique" | "stack";

export interface StackingConfig {
  mode?: StackingMode;
  max_stacks?: number | null;
}

export interface StandaloneEffectDefinition {
  id: string;
  name: string;
  description?: string;
  scope: AugmentationScope;
  target: AugmentationTarget;
  effect: AugmentationEffect;
  active?: boolean;
  lifecycle?: AugmentationLifecycle;
  stacking?: StackingConfig;
}

export interface StandaloneEffectApplication {
  application_id: string;
  definition_id: string;
  instance_id: string;
  source: AugmentationSource;
  active?: boolean;
  stack_index?: number;
}

export type ConditionVisibility = "public" | "gm_only";

export interface ConditionPreset {
  id: string;
  name: string;
  description?: string;
  visibility?: ConditionVisibility;
  augmentation_templates?: Augmentation[];
}

export type ConditionSourceType = "action" | "manual" | "item" | "condition" | "other";

export interface ConditionSource {
  type: ConditionSourceType;
  id?: string | null;
  label?: string | null;
}

export interface ActiveCondition {
  application_id: string;
  condition_id: string;
  condition_name: string;
  description: string;
  visibility: ConditionVisibility;
  instance_id: string;
  augmentation_ids: string[];
  source?: ConditionSource;
  applied_at?: string | null;
  applied_by_role?: "dm" | "player" | null;
  applied_at_state_version?: number | null;
}

export interface ItemDefinition {
  id: string;
  name: string;
  interaction_type: ItemInteractionType;
  category?: string;
  rank?: string;
  description: string;
  world_anvil_url?: string;
  gm_notes?: string;
  gm_special_properties?: string;
  price: string;
  weight: number;
  player_visible?: boolean;
  approval_status?: "approved" | "pending";
  submitted_by_instance_id?: string | null;
  submitted_by_name?: string | null;
  can_contain_items?: boolean;
  contents_weight_behavior?: "normal" | "ignored";
  attribute_profile?: "weapon" | null;
  augmentation_templates?: Augmentation[];
  action_grants?: ItemActionGrant[];
  attributes?: Record<string, AttributeBridge>;
}

export type ItemInteractionType = "equippable" | "consumable" | "inventory_only";

export interface ItemActionGrant {
  action_id: string;
  availability: "carried" | "equipped";
  consume_quantity?: number;
}

export interface Bridge {
  relationship_id: string;
  entry_id: string;
}

export interface ItemBridge {
  relationship_id: string;
  count: number;
  equipped: boolean;
  item_id: string;
  parent_container_id?: string | null;
}

export interface ProficiencyBridge {
  relationship_id: string;
  prof_id: string;
  use_count: number;
  growth_rate: number;
}

export interface ProficiencyDefinition {
  id: string;
  name: string;
  description: string;
  category?: "custom" | "weapon_family";
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

export interface Resistances {
  resistance?: number;
  physical?: number;
  magical?: number;
  slashing?: number;
  bludgeoning?: number;
  piercing?: number;
  arcane?: number;
  fire?: number;
  water?: number;
  earth?: number;
  wind?: number;
  light?: number;
  dark?: number;
  lightning?: number;
  ice?: number;
  time?: number;
  gravity?: number;
  psychic?: number;
}

export interface Sheet {
  id: string;
  name: string;
  notes?: string;
  dm_only: boolean;
  xp_given_when_slayed: number;
  xp_cap: number;
  proficiencies: Record<string, ProficiencyBridge>;
  items: Record<string, ItemBridge>;
  stats: Stats;
  evaluated_stats?: Partial<Record<StatKey, number>>;
  current_carried_weight?: number;
  racial_hp_multiplier?: number;
  max_health?: Formula;
  max_mana?: Formula;
  evaluated_max_health?: number;
  evaluated_max_mana?: number;
  stat_bonuses?: Partial<Record<StatKey, number>>;
  resistances?: Resistances;
  actions: Record<string, Bridge>;
  attributes?: Record<string, AttributeBridge>;
}

export interface PersistentSheet {
  parent_id: string;
  notes?: string;
  health: number;
  mana: number;
  reactions?: number;
  evaluated_max_reactions?: number;
  contribution_points?: number;
  pinned_action_ids?: string[];
  unassigned_stat_points?: number;
  stats?: Stats | null;
  evaluated_stats?: Partial<Record<StatKey, number>>;
  current_carried_weight?: number;
  racial_hp_multiplier?: number;
  max_health?: Formula;
  max_mana?: Formula;
  evaluated_max_health?: number;
  evaluated_max_mana?: number;
  stat_bonuses?: Partial<Record<StatKey, number>>;
  items?: Record<string, ItemBridge>;
  proficiencies?: Record<string, ProficiencyBridge>;
  actions?: Record<string, Bridge>;
  attributes?: Record<string, AttributeBridge>;
  resistances?: Resistances;
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

export interface SheetTemplateView {
  id: string;
  sheet: Sheet;
  kind: SheetKind;
  name: string;
  notes: string;
  stats: Partial<Record<StatKey, number>>;
}

export interface SheetInstanceView {
  id: string;
  persistentSheet: PersistentSheet;
  parentSheet: Sheet | null;
  kind: SheetKind;
  name: string;
  notes: string;
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

export type ActionHistoryStatus = "success" | "failed";
export type ActionHistoryActorRole = "player" | "dm";

export interface ActionHistoryEntry {
  id: string;
  request_id?: string | null;
  action_id: string;
  action_name: string;
  actor_role: ActionHistoryActorRole;
  actor_sheet_id: string;
  actor_instance_id?: string | null;
  target_sheet_id?: string | null;
  created_at: string;
  state_version: number;
  status: ActionHistoryStatus;
  summary: string;
  emitted_messages?: string[];
  mutation_summaries?: string[];
  formula_summaries?: string[];
  error?: string | null;
  redacted?: boolean;
}
