// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SheetStatPointHistory } from "./SheetStatPointHistory";
import type { StatPointEntry, StatPointSummary } from "@/generated/backendProtocol";
let container: HTMLDivElement;
let root: Root;
const summary: StatPointSummary = {
  unspent: 3,
  earned: { starting: 60, level_up: 5, manual: 2 },
  removed: { manual: 1 },
  unspent_sources: { level_up: 3 },
  allocated: { strength: 12 },
  allocation_sources: { strength: { starting: 10, level_up: 2 } },
  player_allocations: { strength: 2 },
  assignment_origins: { strength: { starter: 10, user: 2, dm: 0 } },
  reconciles: true
};
const audit: StatPointEntry[] = [
  {
    id: "entry",
    instance_id: "hero",
    character_name: "Mage",
    occurred_at: "2026-09-10T12:00:00Z",
    actor_role: "player",
    actor_instance_id: "hero",
    request_id: "request",
    request_type: "allocate_instanced_sheet_stat_points",
    kind: "allocation",
    skill: "strength",
    amount: 2,
    previous_value: 10,
    resulting_value: 12,
    previous_unspent: 5,
    resulting_unspent: 3,
    changes: { strength: { level_up: 2 }, unspent: { level_up: -2 } },
    reason: "Private audit note"
  }
];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
const render = async (
  canManage = true,
  projection = summary,
  instanceId = "hero"
): Promise<void> => {
  await act(async () =>
    root.render(
      <SheetStatPointHistory
        instanceId={instanceId}
        summary={projection}
        audit={audit}
        canManage={canManage}
      />
    )
  );
};
describe("Skill point provenance", () => {
  it("shows players source totals and allocations without DM history", async () => {
    await render(false);
    expect(container.textContent).toContain("Starter / Spawned");
    expect(container.textContent).toContain("3 unspent points");
    expect(container.textContent).toContain("Balances reconcile");
    expect(container.textContent).toContain("Level-Up: 2");
    expect(container.querySelectorAll(".stat-point-history__source-card")).toHaveLength(3);
    expect(container.querySelectorAll(".stat-point-history__stat-card")).toHaveLength(6);
    expect(container.querySelector("table")).toBeNull();
    expect(container.textContent).not.toContain("Private audit note");
    expect(container.querySelector("form")).toBeNull();
    await render(false, { ...summary, has_legacy_baseline: true, reconciles: false });
    expect(container.textContent).toContain("Legacy values have unknown origins");
    expect(container.textContent).toContain("Balances need DM review");
  });
  it("shows historical values, actor and timestamp to the DM", async () => {
    await render();
    expect(container.textContent).toContain("10 → 12");
    expect(container.textContent).toContain("Unspent: 5 → 3");
    expect(container.textContent).toContain("player (hero)");
    expect(container.textContent).toContain("Private audit note");
    expect(container.querySelector("time")?.dateTime).toBe(audit[0].occurred_at);
  });
  it("labels additive unspent grants in the DM audit", async () => {
    await act(async () =>
      root.render(
        <SheetStatPointHistory
          instanceId="hero"
          summary={summary}
          audit={[
            {
              ...audit[0],
              kind: "unassigned_grant",
              skill: null,
              amount: 3,
              changes: { unspent: { manual: 3 } }
            }
          ]}
          canManage
          onGrantUnspent={() => undefined}
        />
      )
    );
    expect(container.textContent).toContain("Gave unassigned points");
    expect(container.textContent).toContain("Grant Unspent Points");
  });
});
