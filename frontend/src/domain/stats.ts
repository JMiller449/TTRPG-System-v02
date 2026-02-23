import type { StatKey } from "@/domain/models";

export const CORE_SUBSTAT_GROUPS = [
  { core: "strength", subs: ["lifting", "carry_weight"] },
  { core: "dexterity", subs: ["acrobatics", "stamina", "reaction_time"] },
  { core: "constitution", subs: ["health", "endurance", "pain_tolerance"] },
  { core: "perception", subs: ["sight_distance", "intuition", "registration"] },
  { core: "arcane", subs: ["mana", "control", "sensitivity"] },
  { core: "will", subs: ["charisma", "mental_fortitude", "courage"] }
] as const;

export type CoreStatKey = (typeof CORE_SUBSTAT_GROUPS)[number]["core"];
export type GroupedSubStatKey = (typeof CORE_SUBSTAT_GROUPS)[number]["subs"][number];
export type SheetStatKey = CoreStatKey | GroupedSubStatKey;
export type ResourceKey = "health" | "mana";

export const RESOURCE_KEYS: readonly ResourceKey[] = ["health", "mana"];

export const ALL_STATS: readonly StatKey[] = [
  "strength",
  "dexterity",
  "constitution",
  "perception",
  "arcane",
  "will",
  "lifting",
  "carry_weight",
  "acrobatics",
  "stamina",
  "reaction_time",
  "health",
  "endurance",
  "pain_tolerance",
  "sight_distance",
  "intuition",
  "registration",
  "mana",
  "control",
  "sensitivity",
  "charisma",
  "mental_fortitude",
  "courage"
];

export const STAT_LABELS: Record<StatKey, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
  constitution: "Constitution",
  perception: "Perception",
  arcane: "Arcane",
  will: "Will",
  lifting: "Lifting",
  carry_weight: "Carry Weight",
  acrobatics: "Acrobatics",
  stamina: "Stamina",
  reaction_time: "Reaction Time",
  health: "Health",
  endurance: "Endurance",
  pain_tolerance: "Pain Tolerance",
  sight_distance: "Sight Distance",
  intuition: "Intuition",
  registration: "Registration",
  mana: "Mana",
  control: "Control",
  sensitivity: "Sensitivity",
  charisma: "Charisma",
  mental_fortitude: "Mental Fortitude",
  courage: "Courage"
};

export const DISPLAY_NAMES: Record<SheetStatKey, string> = {
  strength: STAT_LABELS.strength,
  dexterity: STAT_LABELS.dexterity,
  constitution: STAT_LABELS.constitution,
  perception: STAT_LABELS.perception,
  arcane: STAT_LABELS.arcane,
  will: STAT_LABELS.will,
  lifting: STAT_LABELS.lifting,
  carry_weight: STAT_LABELS.carry_weight,
  acrobatics: STAT_LABELS.acrobatics,
  stamina: STAT_LABELS.stamina,
  reaction_time: STAT_LABELS.reaction_time,
  health: STAT_LABELS.health,
  endurance: STAT_LABELS.endurance,
  pain_tolerance: STAT_LABELS.pain_tolerance,
  sight_distance: STAT_LABELS.sight_distance,
  intuition: STAT_LABELS.intuition,
  registration: STAT_LABELS.registration,
  mana: STAT_LABELS.mana,
  control: STAT_LABELS.control,
  sensitivity: STAT_LABELS.sensitivity,
  charisma: STAT_LABELS.charisma,
  mental_fortitude: STAT_LABELS.mental_fortitude,
  courage: STAT_LABELS.courage
};

export function isResourceKey(value: string): value is ResourceKey {
  return RESOURCE_KEYS.includes(value as ResourceKey);
}
