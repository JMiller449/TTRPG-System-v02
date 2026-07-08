import { CORE_STAT_KEYS, type CoreStatKey } from "@/features/sheets/sheetDisplay";

export type StatPointAllocation = Record<CoreStatKey, number>;

export function createEmptyStatPointAllocation(): StatPointAllocation {
  return Object.fromEntries(CORE_STAT_KEYS.map((key) => [key, 0])) as StatPointAllocation;
}

export function sumStatPointAllocation(allocation: StatPointAllocation): number {
  return CORE_STAT_KEYS.reduce((total, key) => total + Math.max(0, allocation[key] ?? 0), 0);
}

export function incrementStatPointAllocation(
  allocation: StatPointAllocation,
  stat: CoreStatKey,
  availablePoints: number
): StatPointAllocation {
  if (sumStatPointAllocation(allocation) >= availablePoints) {
    return allocation;
  }
  return { ...allocation, [stat]: allocation[stat] + 1 };
}

export function decrementStatPointAllocation(
  allocation: StatPointAllocation,
  stat: CoreStatKey
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
    CORE_STAT_KEYS.flatMap((key) => {
      const value = allocation[key] ?? 0;
      return value > 0 ? [[key, value]] : [];
    })
  );
}
