import type { ActionDefinition, Sheet, StatKey } from "@/domain/models";
import { STAT_LABELS } from "@/domain/stats";

export type QuickRollAction = "attack" | "dodge" | "parry" | "block";

export const QUICK_ROLL_ACTIONS: readonly QuickRollAction[] = [
  "attack",
  "dodge",
  "parry",
  "block"
];

export const QUICK_ROLL_DEFAULT_STATS: Record<QuickRollAction, StatKey> = {
  attack: "strength",
  dodge: "dexterity",
  parry: "dexterity",
  block: "constitution"
};

export interface ResolvedQuickRollAction {
  action: QuickRollAction;
  actionId: string;
  actionName: string;
  relationshipId: string;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getQuickRollRelationshipId(action: QuickRollAction): string {
  return `default_${action}`;
}

export function resolveQuickRollAction(
  sheet: Sheet | null | undefined,
  actions: Record<string, ActionDefinition>,
  action: QuickRollAction
): ResolvedQuickRollAction | null {
  if (!sheet) {
    return null;
  }

  const relationshipId = getQuickRollRelationshipId(action);
  const bridge =
    sheet.actions[relationshipId] ??
    Object.values(sheet.actions).find((entry) => entry.entry_id === action);
  if (!bridge) {
    return null;
  }

  const actionDefinition = actions[bridge.entry_id];
  if (!actionDefinition) {
    return null;
  }

  return {
    action,
    actionId: actionDefinition.id,
    actionName: actionDefinition.name,
    relationshipId: bridge.relationship_id
  };
}

export function getQuickRollContext(action: QuickRollAction, activeWeapon?: string | null): string {
  if (action === "attack") {
    return activeWeapon ? `Attack with ${activeWeapon}` : "Attack";
  }
  return capitalize(action);
}

export function getQuickRollLabel(action: QuickRollAction, activeWeapon?: string | null): string {
  if (action === "attack" && activeWeapon) {
    return `Attack (${activeWeapon})`;
  }
  return capitalize(action);
}

export function getRollEquationPreview(
  stat: StatKey,
  action: QuickRollAction | null,
  activeWeapon?: string | null
): string {
  const statTerm = `[${STAT_LABELS[stat]}]`;
  if (!action) {
    return `[ROLL_DICE_TODO] + ${statTerm} + [ACTION_MOD_TODO]`;
  }

  if (action === "attack") {
    const weaponTerm = activeWeapon ? `[WEAPON_MOD_TODO:${activeWeapon}]` : "[WEAPON_MOD_TODO]";
    return `[ROLL_DICE_TODO] + ${statTerm} + ${weaponTerm} + [ATTACK_MOD_TODO]`;
  }

  return `[ROLL_DICE_TODO] + ${statTerm} + [${action.toUpperCase()}_MOD_TODO]`;
}

export function formatDiceExpression(count: number, sides: number): string {
  return `${Math.max(1, count)}d${sides}`;
}
