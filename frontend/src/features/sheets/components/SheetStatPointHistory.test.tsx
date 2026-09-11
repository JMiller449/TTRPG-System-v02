// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SheetStatPointHistory } from "./SheetStatPointHistory";
import type { StatPointEntry, StatPointSummary } from "@/generated/backendProtocol";
import type { GameClient } from "@/hooks/useGameClient";
import type { IntentFeedbackItem } from "@/app/state/types";

const store = vi.hoisted(() => ({ feedback: [] as IntentFeedbackItem[] }));
vi.mock("@/app/state/useAppStore", () => ({
  useAppStore: () => ({ state: { uiState: { intentFeedback: store.feedback } } })
}));
let container: HTMLDivElement;
let root: Root;
const send = vi.fn();
const client = { sendProtocolRequest: send } as unknown as GameClient;
const summary: StatPointSummary = {
  unspent: 3,
  earned: { starting: 60, level_up: 5, manual: 2 },
  removed: { manual: 1 },
  unspent_sources: { level_up: 3 },
  allocated: { strength: 12 },
  allocation_sources: { strength: { starting: 10, level_up: 2 } },
  player_allocations: { strength: 2 },
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
  send.mockClear();
  store.feedback = [];
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
        client={client}
      />
    )
  );
};
const setInput = async (value: string): Promise<void> => {
  const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("Skill point provenance", () => {
  it("shows players source totals and allocations without DM history", async () => {
    await render(false);
    expect(container.textContent).toContain("Starting / Spawned");
    expect(container.textContent).toContain("3 unspent points");
    expect(container.textContent).toContain("Balances reconcile");
    expect(container.textContent).toContain("Level-Up: 2");
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
  it("submits source metadata and reconciles only after server feedback", async () => {
    await render();
    const source = container.querySelectorAll("select")[1];
    await act(async () => {
      source.value = "level_up";
      source.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await setInput("8");
    const button = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    await act(async () => button.click());
    const request = send.mock.calls[0][0];
    expect(request).toMatchObject({
      type: "set_instanced_sheet_unassigned_stat_points",
      instance_id: "hero",
      point_source: "level_up",
      value: 8
    });
    expect(button.disabled).toBe(true);
    expect(container.textContent).toContain("3 unspent points");
    store.feedback = [
      {
        id: "failed",
        intentId: request.request_id,
        status: "error",
        message: "Rejected",
        createdAt: "now"
      }
    ];
    await render();
    expect(container.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe("8");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Rejected");
    await act(async () => button.click());
    const retry = send.mock.calls[1][0];
    store.feedback = [
      {
        id: "success",
        intentId: retry.request_id,
        status: "success",
        message: "Saved",
        createdAt: "now"
      }
    ];
    await render(true, { ...summary, unspent: 8 });
    expect(container.textContent).toContain("8 unspent points");
    expect(button.disabled).toBe(true);
    await render(true, { ...summary, unspent: 1 }, "other");
    expect(container.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe("1");
  });
  it("submits a direct core stat assignment for a level-up award", async () => {
    await render();
    const [destination, source] = container.querySelectorAll("select");
    await act(async () => {
      destination.value = "strength";
      destination.dispatchEvent(new Event("change", { bubbles: true }));
      source.value = "level_up";
      source.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe("12");
    await setInput("15");
    await act(async () =>
      container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
    );
    expect(send.mock.calls[0][0]).toMatchObject({
      type: "set_instanced_sheet_base_stat",
      stat_name: "strength",
      value: 15,
      point_source: "level_up"
    });
  });
});
