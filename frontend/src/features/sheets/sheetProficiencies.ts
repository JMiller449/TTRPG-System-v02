import type { ProficiencyBridge, ProficiencyDefinition } from "@/domain/models";
import type { SheetProficiencyBridgePayload } from "@/infrastructure/ws/requestBuilders";

export interface SheetProficiencyEntry {
  bridge: ProficiencyBridge;
  proficiency: ProficiencyDefinition | null;
  label: string;
}

export function getSheetProficiencyPercentage(bridge: ProficiencyBridge): number {
  return Math.min(100, Math.max(0, bridge.growth_rate * bridge.use_count * 100));
}

export function formatSheetProficiencyPercentage(bridge: ProficiencyBridge): string {
  const percentage = getSheetProficiencyPercentage(bridge);
  return Number.isInteger(percentage) ? String(percentage) : percentage.toFixed(2);
}

export function selectSheetProficiencyEntries(
  bridges: ProficiencyBridge[],
  definitions: Record<string, ProficiencyDefinition>
): SheetProficiencyEntry[] {
  return bridges.map((bridge) => {
    const proficiency = definitions[bridge.prof_id] ?? null;
    return {
      bridge,
      proficiency,
      label: proficiency?.name ?? bridge.prof_id
    };
  });
}

export function selectAvailableSheetProficiencies(
  definitions: Record<string, ProficiencyDefinition>,
  order: string[],
  bridges: ProficiencyBridge[]
): ProficiencyDefinition[] {
  const assignedProficiencyIds = new Set(bridges.map((bridge) => bridge.prof_id));
  return order
    .map((proficiencyId) => definitions[proficiencyId])
    .filter(
      (proficiency): proficiency is ProficiencyDefinition =>
        Boolean(proficiency) && !assignedProficiencyIds.has(proficiency.id)
    );
}

export function parseSheetProficiencyUseCount(raw: string): number | null {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function parseSheetProficiencyGrowthRate(raw: string): number | null {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function toSheetProficiencyBridgePayload({
  relationshipId,
  proficiencyId,
  useCount,
  growthRate
}: {
  relationshipId: string;
  proficiencyId: string;
  useCount: number;
  growthRate: number;
}): SheetProficiencyBridgePayload {
  return {
    relationship_id: relationshipId,
    prof_id: proficiencyId,
    use_count: useCount,
    growth_rate: growthRate
  };
}
