export type StatKey =
  | "strength" | "dexterity" | "constitution" | "perception" | "arcane" | "will"
  | "lifting" | "carry_weight" | "acrobatics" | "stamina" | "reaction_time"
  | "health" | "endurance" | "pain_tolerance" | "sight_distance" | "intuition"
  | "registration" | "mana" | "control" | "sensitivity" | "charisma"
  | "mental_fortitude" | "courage";
export type ActionRollModeKind = "none" | "check" | "damage";
export interface ActionDefinition {
  id: string;
  name: string;
  roll_mode_kind?: ActionRollModeKind;
  notes?: string;
}
