import { ALL_STATS, type SheetStatKey } from "@/domain/stats";

export type StatPointAllocation = Record<SheetStatKey, number>;

export function createEmptyStatPointAllocation(): StatPointAllocation {
  return Object.fromEntries(ALL_STATS.map((key) => [key, 0])) as StatPointAllocation;
}

export function sumStatPointAllocation(allocation: StatPointAllocation): number {
  return ALL_STATS.reduce((total, key) => total + Math.max(0, allocation[key] ?? 0), 0);
}

export function incrementStatPointAllocation(
  allocation: StatPointAllocation,
  stat: SheetStatKey,
  availablePoints: number
): StatPointAllocation {
  if (sumStatPointAllocation(allocation) >= availablePoints) {
    return allocation;
  }
  return { ...allocation, [stat]: allocation[stat] + 1 };
}

export function decrementStatPointAllocation(
  allocation: StatPointAllocation,
  stat: SheetStatKey
): StatPointAllocation {
  if (allocation[stat] <= 0) {
    return allocation;
  }
  return { ...allocation, [stat]: allocation[stat] - 1 };
}

export function positiveStatPointAllocationPayload(
  allocation: StatPointAllocation
): Record<string, number> {
  return Object.fromEntries(
    ALL_STATS.flatMap((key) => {
      const value = allocation[key] ?? 0;
      return value > 0 ? [[key, value]] : [];
    })
  );
}
