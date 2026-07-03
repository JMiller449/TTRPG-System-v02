import type { ActionDefinition, ActionRollModeKind, StatKey } from "@/domain/models";
import type { ActionViewModel, StatGroupViewModel } from "@/shared/ui/character-sheet-study";

const GROUPS: ReadonlyArray<{
  core: StatKey;
  label: string;
  hint: string;
  substats: ReadonlyArray<{ key: StatKey; label: string; rollable: boolean }>;
}> = [
  { core: "strength", label: "Strength", hint: "Power and physical force", substats: [
    { key: "lifting", label: "Lifting", rollable: true },
    { key: "carry_weight", label: "Carry Weight", rollable: false }
  ]},
  { core: "dexterity", label: "Dexterity", hint: "Speed and coordination", substats: [
    { key: "acrobatics", label: "Acrobatics", rollable: true },
    { key: "stamina", label: "Stamina", rollable: true },
    { key: "reaction_time", label: "Reaction Time", rollable: true }
  ]},
  { core: "constitution", label: "Constitution", hint: "Health and endurance", substats: [
    { key: "health", label: "Health", rollable: false },
    { key: "endurance", label: "Endurance", rollable: true },
    { key: "pain_tolerance", label: "Pain Tolerance", rollable: true }
  ]},
  { core: "perception", label: "Perception", hint: "Awareness and processing", substats: [
    { key: "sight_distance", label: "Sight Distance", rollable: true },
    { key: "intuition", label: "Intuition", rollable: true },
    { key: "registration", label: "Registration", rollable: true }
  ]},
  { core: "arcane", label: "Arcane", hint: "Magic capacity and control", substats: [
    { key: "mana", label: "Mana", rollable: false },
    { key: "control", label: "Control", rollable: true },
    { key: "sensitivity", label: "Sensitivity", rollable: true }
  ]},
  { core: "will", label: "Will", hint: "Resolve and presence", substats: [
    { key: "charisma", label: "Charisma", rollable: true },
    { key: "mental_fortitude", label: "Mental Fortitude", rollable: true },
    { key: "courage", label: "Courage", rollable: true }
  ]}
];

export function buildStatGroups(
  stats: Partial<Record<StatKey, number>>,
  onRoll?: (key: StatKey) => void | Promise<void>
): StatGroupViewModel[] {
  return GROUPS.map((group) => ({
    id: group.core,
    label: group.label,
    value: stats[group.core] ?? 0,
    hint: group.hint,
    onRoll: onRoll ? () => onRoll(group.core) : undefined,
    substats: group.substats.map((substat) => ({
      id: substat.key,
      label: substat.label,
      value: stats[substat.key] ?? 0,
      onRoll: substat.rollable && onRoll ? () => onRoll(substat.key) : undefined
    }))
  }));
}

export interface AssignedActionLike {
  actionId: string;
  action: ActionDefinition;
  sourceItemRelationshipId?: string;
  category?: string;
  cost?: string;
  tags?: string[];
  disabledReason?: string;
  pending?: boolean;
  isFavorite?: boolean;
}

export interface PerformActionIntent {
  actionId: string;
  sourceItemRelationshipId?: string;
  rollMode: ActionRollModeKind;
}

function rollLabel(mode: ActionRollModeKind | undefined): string {
  if (mode === "damage") return "Roll damage";
  if (mode === "check") return "Make check";
  return "Use action";
}

export function buildActionCards(
  assigned: readonly AssignedActionLike[],
  onPerform: (intent: PerformActionIntent) => void | Promise<void>,
  onToggleFavorite?: (actionId: string) => void
): ActionViewModel[] {
  return assigned.map((entry) => ({
    id: `${entry.actionId}:${entry.sourceItemRelationshipId ?? "sheet"}`,
    name: entry.action.name,
    summary: entry.action.notes,
    category: entry.category ?? "Action",
    cost: entry.cost,
    tags: entry.tags,
    rollLabel: rollLabel(entry.action.roll_mode_kind),
    disabledReason: entry.disabledReason,
    pending: entry.pending,
    isFavorite: entry.isFavorite,
    onToggleFavorite: onToggleFavorite ? () => onToggleFavorite(entry.actionId) : undefined,
    onPerform: entry.disabledReason ? undefined : () => onPerform({
      actionId: entry.actionId,
      sourceItemRelationshipId: entry.sourceItemRelationshipId,
      rollMode: entry.action.roll_mode_kind ?? "none"
    })
  }));
}
