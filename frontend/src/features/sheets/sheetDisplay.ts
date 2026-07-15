import {
  CORE_SUBSTAT_GROUPS,
  CORE_STAT_KEYS,
  DISPLAY_NAMES,
  isCoreStatKey,
  isResourceKey,
  RESOURCE_KEYS,
  type CoreStatKey,
  type ResourceKey,
  type SheetStatKey
} from "@/domain/stats";
import { DAMAGE_TYPES, type DamageType } from "@/domain/models";

export type PlayerSheetTab =
  | "overview"
  | "actions"
  | "inventory"
  | "attributes"
  | "proficiencies"
  | "kills"
  | "notes"
  | "action_history"
  | "formula_stats"
  | "resistances";

export const PLAYER_HEALTH_DAMAGE_TYPES = DAMAGE_TYPES.map((damageType) => ({
  value: damageType,
  label: damageType
}));

export type HealthDamageType = DamageType | "";

export function parseModifierInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 0;
  }
  if (!/^[+-]?\d+$/.test(trimmed)) {
    return null;
  }
  return Number(trimmed);
}

export function formatModifier(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export {
  CORE_STAT_KEYS,
  CORE_SUBSTAT_GROUPS,
  DISPLAY_NAMES,
  isCoreStatKey,
  isResourceKey,
  RESOURCE_KEYS
};
export type { CoreStatKey, ResourceKey, SheetStatKey };
