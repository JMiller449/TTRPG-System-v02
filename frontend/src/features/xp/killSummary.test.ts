import { describe, expect, it } from "vitest";
import type { XpTrackerKillEvent } from "@/generated/backendProtocol";
import { summarizeKills } from "@/features/xp/killSummary";

function kill(id: string, monsterName: string, quantity?: number): XpTrackerKillEvent {
  return {
    id,
    monster_name: monsterName,
    quantity,
    base_xp: 10,
    participants: [{ instance_id: "hero", name: "Hero" }],
    participant_count: 1,
    xp_percentage: 100,
    xp_per_participant: 10,
    occurred_at: "2026-09-08T12:00:00+00:00"
  };
}

describe("summarizeKills", () => {
  it("groups names without case or whitespace differences and totals batch quantities", () => {
    const summary = summarizeKills([
      kill("zombie_batch", "Zombie", 55),
      kill("goblin_batch", "Goblin", 20),
      kill("zombie_legacy", "  zombie  "),
      kill("zombie_patrol", "ZOMBIE", 4)
    ]);

    expect(summary.totalQuantity).toBe(80);
    expect(summary.groups).toEqual([
      { key: "zombie", monsterName: "Zombie", quantity: 60, recordCount: 3 },
      { key: "goblin", monsterName: "Goblin", quantity: 20, recordCount: 1 }
    ]);
  });

  it("sorts equal totals by displayed enemy name", () => {
    const summary = summarizeKills([kill("zombie", "Zombie", 2), kill("goblin", "Goblin", 2)]);

    expect(summary.groups.map((group) => group.monsterName)).toEqual(["Goblin", "Zombie"]);
  });
});
