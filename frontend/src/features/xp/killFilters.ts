import type { XpTrackerKillEvent } from "@/generated/backendProtocol";

export type KillFilters = {
  search: string;
  participantId: string;
  enemyKey: string;
  fromDate: string;
  toDate: string;
};

export const emptyKillFilters: KillFilters = {
  search: "",
  participantId: "",
  enemyKey: "",
  fromDate: "",
  toDate: ""
};

export function killEnemyKey(kill: XpTrackerKillEvent): string {
  return kill.monster_sheet_id
    ? `template:${kill.monster_sheet_id}`
    : `custom:${kill.monster_name.trim().toLocaleLowerCase()}`;
}

export function hasInvalidKillDateRange(filters: KillFilters): boolean {
  return Boolean(filters.fromDate && filters.toDate && filters.fromDate > filters.toDate);
}

function localDateKey(timestamp: string): string | null {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

export function filterKills(
  kills: readonly XpTrackerKillEvent[],
  filters: KillFilters
): XpTrackerKillEvent[] {
  if (hasInvalidKillDateRange(filters)) return [];
  const query = filters.search.trim().toLocaleLowerCase();
  return kills.filter((kill) => {
    if (
      filters.participantId &&
      !kill.participants.some((participant) => participant.instance_id === filters.participantId)
    )
      return false;
    if (filters.enemyKey && killEnemyKey(kill) !== filters.enemyKey) return false;
    if (filters.fromDate || filters.toDate) {
      const date = localDateKey(kill.occurred_at);
      if (
        !date ||
        (filters.fromDate && date < filters.fromDate) ||
        (filters.toDate && date > filters.toDate)
      )
        return false;
    }
    return (
      !query ||
      [
        kill.monster_name,
        ...kill.participants.map((participant) => participant.name),
        kill.notes ?? "",
        kill.submitted_by_name ?? ""
      ].some((value) => value.toLocaleLowerCase().includes(query))
    );
  });
}

export type KillFilterOption = { value: string; label: string };

function sortedOptions(entries: Map<string, string>): KillFilterOption[] {
  const labelCounts = new Map<string, number>();
  for (const label of entries.values()) labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  return [...entries]
    .map(([value, label]) => ({
      value,
      label:
        (labelCounts.get(label) ?? 0) > 1 ? `${label} (${value.replace(/^template:/, "")})` : label
    }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value));
}

export function killFilterOptions(kills: readonly XpTrackerKillEvent[]): {
  participants: KillFilterOption[];
  enemies: KillFilterOption[];
} {
  const participants = new Map<string, string>();
  const enemies = new Map<string, string>();
  // Projections arrive newest first. Keep the most recent historical display name.
  for (const kill of kills) {
    for (const participant of kill.participants) {
      if (!participants.has(participant.instance_id))
        participants.set(participant.instance_id, participant.name);
    }
    const enemyKey = killEnemyKey(kill);
    if (!enemies.has(enemyKey))
      enemies.set(enemyKey, `${kill.monster_name}${kill.monster_sheet_id ? "" : " (custom)"}`);
  }
  return { participants: sortedOptions(participants), enemies: sortedOptions(enemies) };
}
