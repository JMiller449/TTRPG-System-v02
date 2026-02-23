import {
  CORE_SUBSTAT_GROUPS,
  DISPLAY_NAMES,
  isResourceKey,
  RESOURCE_KEYS,
  type ResourceKey,
  type SheetStatKey
} from "@/domain/stats";

export type PlayerSheetTab = "stats" | "equipment" | "notes";

export const PLAYER_HEALTH_DAMAGE_TYPES = [
  { value: "untyped", label: "Untyped" },
  { value: "physical", label: "Physical" },
  { value: "fire", label: "Fire" },
  { value: "magic", label: "Magic" }
] as const;

export type HealthDamageType = (typeof PLAYER_HEALTH_DAMAGE_TYPES)[number]["value"];

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

export { CORE_SUBSTAT_GROUPS, DISPLAY_NAMES, isResourceKey, RESOURCE_KEYS };
export type { ResourceKey, SheetStatKey };
