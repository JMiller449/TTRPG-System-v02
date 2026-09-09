import { describe, expect, it } from "vitest";
import type { XpTrackerKillEvent } from "@/generated/backendProtocol";
import { emptyKillFilters, filterKills, killEnemyKey, killFilterOptions } from "./killFilters";

function kill(overrides: Partial<XpTrackerKillEvent> = {}): XpTrackerKillEvent {
  return {
    id: "batch",
    monster_name: "Goblin",
    monster_sheet_id: "goblin",
    quantity: 5,
    base_xp: 100,
    participants: [{ instance_id: "retired", name: "Old Hero" }],
    participant_count: 1,
    xp_percentage: 100,
    xp_per_participant: 500,
    occurred_at: new Date(2026, 8, 9, 23, 59, 59, 999).toISOString(),
    notes: "North gate",
    ...overrides
  };
}

describe("kill history filtering", () => {
  it("combines all filters without changing batches or awards", () => {
    const batch = kill();
    const other = kill({ id: "other", participants: [{ instance_id: "other", name: "Old Hero" }] });
    const result = filterKills([batch, other], {
      search: " GATE ",
      participantId: "retired",
      enemyKey: "template:goblin",
      fromDate: "2026-09-09",
      toDate: "2026-09-09"
    });
    expect(result).toEqual([batch]);
    expect(result[0]).toBe(batch);
    expect(batch.quantity).toBe(5);
    expect(batch.xp_per_participant).toBe(500);
  });

  it("includes the full local day across a daylight saving transition", () => {
    const times = [
      new Date(2026, 2, 7, 23, 59, 59, 999),
      new Date(2026, 2, 8, 0, 0),
      new Date(2026, 2, 8, 23, 59, 59, 999),
      new Date(2026, 2, 9, 0, 0)
    ];
    const records = times.map((date, index) =>
      kill({ id: String(index), occurred_at: date.toISOString() })
    );
    expect(
      filterKills(records, {
        ...emptyKillFilters,
        fromDate: "2026-03-08",
        toDate: "2026-03-08"
      }).map((record) => record.id)
    ).toEqual(["1", "2"]);
    expect(filterKills(records, { ...emptyKillFilters, fromDate: "2026-03-08" })).toHaveLength(3);
    expect(filterKills(records, { ...emptyKillFilters, toDate: "2026-03-08" })).toHaveLength(3);
  });

  it("rejects reversed ranges and excludes malformed timestamps only when filtering dates", () => {
    const record = kill({ occurred_at: "invalid" });
    expect(filterKills([record], emptyKillFilters)).toEqual([record]);
    expect(filterKills([record], { ...emptyKillFilters, fromDate: "2026-09-09" })).toEqual([]);
    expect(
      filterKills([kill()], { ...emptyKillFilters, fromDate: "2026-09-10", toDate: "2026-09-09" })
    ).toEqual([]);
  });

  it("builds choices from historical identities and separates same-named enemies", () => {
    const records = [
      kill(),
      kill({ id: "custom", monster_sheet_id: null }),
      kill({
        id: "renamed",
        monster_name: "Old Goblin",
        participants: [{ instance_id: "retired", name: "Former Name" }]
      }),
      kill({
        id: "other",
        monster_sheet_id: "goblin-2",
        participants: [{ instance_id: "other", name: "Old Hero" }]
      })
    ];
    const options = killFilterOptions(records);
    expect(options.participants).toHaveLength(2);
    expect(options.participants.map((option) => option.label)).toEqual([
      "Old Hero (other)",
      "Old Hero (retired)"
    ]);
    expect(options.enemies).toHaveLength(3);
    expect(filterKills(records, { ...emptyKillFilters, enemyKey: "template:goblin" })).toHaveLength(
      2
    );
    expect(filterKills(records, { ...emptyKillFilters, enemyKey: "custom:goblin" })).toEqual([
      records[1]
    ]);
    expect(killEnemyKey(kill({ monster_sheet_id: null, monster_name: " GOBLIN " }))).toBe(
      "custom:goblin"
    );
  });

  it("searches historical names, notes, and recorder names case-insensitively", () => {
    const record = kill({ submitted_by_name: "Game Master" });
    for (const search of ["GOBLIN", "old HERO", "North gate", "MASTER", "  "]) {
      expect(filterKills([record], { ...emptyKillFilters, search })).toEqual([record]);
    }
    expect(filterKills([record], { ...emptyKillFilters, search: "missing" })).toEqual([]);
  });
});
