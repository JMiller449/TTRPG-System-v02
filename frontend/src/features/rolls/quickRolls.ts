import type { StatKey } from "@/domain/models";
import { STAT_LABELS } from "@/domain/stats";

export type QuickRollAction = "attack" | "dodge" | "parry" | "block";

export const QUICK_ROLL_ACTIONS: readonly QuickRollAction[] = [
  "attack",
  "dodge",
  "parry",
  "block"
];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
