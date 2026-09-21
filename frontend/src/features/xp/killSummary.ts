import type { XpTrackerKillEvent } from "@/generated/backendProtocol";

export interface KillSummaryGroup {
  key: string;
  monsterName: string;
  quantity: number;
  recordCount: number;
}

export interface KillSummary {
  groups: KillSummaryGroup[];
  totalQuantity: number;
}

function normalizedMonsterName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function killQuantity(kill: XpTrackerKillEvent): number {
  const quantity = kill.quantity ?? 1;
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
}

export function summarizeKills(kills: readonly XpTrackerKillEvent[]): KillSummary {
  const grouped = new Map<string, KillSummaryGroup>();

  kills.forEach((kill) => {
    const monsterName = kill.monster_name.trim().replace(/\s+/g, " ") || "Unknown enemy";
    const key = normalizedMonsterName(monsterName);
    const existing = grouped.get(key);

    if (existing) {
      existing.quantity += killQuantity(kill);
      existing.recordCount += 1;
      return;
    }

    grouped.set(key, {
      key,
      monsterName,
      quantity: killQuantity(kill),
      recordCount: 1
    });
  });

  const groups = [...grouped.values()].sort(
    (left, right) =>
      right.quantity - left.quantity || left.monsterName.localeCompare(right.monsterName)
  );

  return {
    groups,
    totalQuantity: groups.reduce((total, group) => total + group.quantity, 0)
  };
}
