// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import type { ServerEvent, XpTrackerView } from "@/domain/ipc";
import type { XpTrackerKillEvent } from "@/generated/backendProtocol";
import type { GameClient } from "@/hooks/useGameClient";
import { XpTrackerPage } from "./XpTrackerPage";
import { SheetKillsSection } from "./SheetKillsSection";

const goblin: XpTrackerKillEvent = {
  id: "goblin-batch",
  monster_name: "Goblin",
  monster_sheet_id: "goblin",
  quantity: 5,
  base_xp: 100,
  participants: [
    { instance_id: "hero", name: "Hero" },
    { instance_id: "retired", name: "Retired Hero" }
  ],
  participant_count: 2,
  xp_percentage: 50,
  xp_per_participant: 250,
  occurred_at: new Date(2026, 8, 9, 23, 59).toISOString(),
  notes: "Gate battle"
};
const custom: XpTrackerKillEvent = {
  ...goblin,
  id: "custom",
  monster_name: "Wraith",
  monster_sheet_id: null,
  quantity: 1,
  notes: "Forest"
};
const orc: XpTrackerKillEvent = {
  ...goblin,
  id: "orc",
  monster_name: "Orc",
  monster_sheet_id: "orc",
  quantity: 1,
  participants: [{ instance_id: "other", name: "Other Hero" }],
  occurred_at: new Date(2026, 8, 10, 0, 0).toISOString()
};

function tracker(kills: XpTrackerKillEvent[] = [goblin, custom, orc]): XpTrackerView {
  return {
    can_manage: true,
    parties: [],
    kills,
    adjustments: [],
    recordable_mobs: [],
    mobs: [],
    sheets: ["hero", "other"].map((id) => ({
      instance_id: id,
      sheet_id: id,
      name: id,
      kills: kills.filter((kill) => kill.participants.some((p) => p.instance_id === id)),
      adjustments: [],
      current_xp: 0,
      xp_required: 1000,
      ready_to_level: false
    }))
  };
}

let container: HTMLDivElement;
let root: Root;
let sendProtocolRequest: ReturnType<typeof vi.fn>;
let client: GameClient;
let listener: ((event: ServerEvent) => void) | undefined;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  sendProtocolRequest = vi.fn();
  listener = undefined;
  client = {
    sendProtocolRequest,
    onEvent: (next: (event: ServerEvent) => void) => {
      listener = next;
      return () => undefined;
    }
  } as unknown as GameClient;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(view: XpTrackerView, instanceId?: string): Promise<void> {
  await act(async () =>
    root.render(
      <StoreContext.Provider
        value={{
          state: {
            ...initialState,
            serverState: { ...initialState.serverState, role: view.can_manage ? "gm" : "player" },
            uiState: { ...initialState.uiState, xpTracker: view }
          },
          dispatch: () => undefined
        }}
      >
        {instanceId ? (
          <SheetKillsSection client={client} instanceId={instanceId} sheetId={instanceId} />
        ) : (
          <XpTrackerPage client={client} />
        )}
      </StoreContext.Provider>
    )
  );
}

function button(text: string): HTMLButtonElement {
  return [...container.querySelectorAll("button")].find((element) => element.textContent === text)!;
}

function field(label: string): HTMLInputElement | HTMLSelectElement {
  return [...container.querySelectorAll("label")]
    .find((element) => element.querySelector(".field__label")?.textContent === label)!
    .querySelector("input, select")!;
}

async function change(element: HTMLInputElement | HTMLSelectElement, value: string): Promise<void> {
  await act(async () => {
    const prototype =
      element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })
    );
  });
}

async function openRegistry(): Promise<void> {
  await render(tracker());
  await act(async () => button("Kill Registry").click());
  await act(async () => container.querySelector("summary")!.click());
  sendProtocolRequest.mockClear();
}

describe("kill filters in the existing views", () => {
  it("records a batch once, retains its quantity on error, and resets after its matching response", async () => {
    await openRegistry();
    const pickers = container.querySelectorAll<HTMLInputElement>('input[role="combobox"]');
    await act(async () => {
      pickers[0].focus();
      pickers[0].click();
    });
    await act(async () =>
      [...document.querySelectorAll<HTMLElement>('[role="option"]')]
        .find((option) => option.textContent === "hero")!
        .click()
    );
    await act(async () => {
      pickers[1].focus();
      pickers[1].click();
    });
    await act(async () =>
      [...document.querySelectorAll<HTMLElement>('[role="option"]')]
        .find((option) => option.textContent?.includes("Arbitrary kill"))!
        .click()
    );
    await change(field("Monster name"), "Skeleton");
    await change(field("XP per kill"), "12.5");
    const quantity = container.querySelector<HTMLInputElement>(
      'input[title="Number of enemies of this type defeated in this entry"]'
    )!;
    await change(quantity, "5");
    expect(button("Record 5 Kills")).toBeDefined();
    const form = container.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(sendProtocolRequest).toHaveBeenCalledTimes(1);
    const request = sendProtocolRequest.mock.calls[0][0];
    expect(request).toMatchObject({
      type: "record_kill",
      quantity: 5,
      monster_name: "Skeleton",
      credited_instance_id: "hero",
      base_xp: 12.5
    });
    expect(quantity.disabled).toBe(true);
    await act(async () =>
      listener?.({ type: "error", requestId: request.request_id, message: "Try again" })
    );
    expect(quantity.disabled).toBe(false);
    expect(quantity.value).toBe("5");
    await act(async () => button("Record 5 Kills").click());
    const retry = sendProtocolRequest.mock.calls[1][0];
    await act(async () =>
      listener?.({ type: "xp_tracker", tracker: tracker(), requestId: "unrelated" })
    );
    expect(quantity.value).toBe("5");
    expect(quantity.disabled).toBe(true);
    await act(async () =>
      listener?.({ type: "xp_tracker", tracker: tracker(), requestId: retry.request_id })
    );
    expect(quantity.value).toBe("1");
    expect(quantity.disabled).toBe(false);
  });

  it("edits the quantity through the existing historical kill editor", async () => {
    await openRegistry();
    await act(async () => button("Edit").click());
    const quantity = container.querySelector<HTMLInputElement>(
      '.xp-kill-editor input[title="Number of enemies of this type defeated in this entry"]'
    )!;
    expect(quantity.value).toBe("5");
    await change(quantity, "3");
    await act(async () => button("Save Changes").click());
    expect(sendProtocolRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "update_kill",
        kill_id: "goblin-batch",
        quantity: 3,
        base_xp: 100,
        participant_instance_ids: ["hero", "retired"]
      }),
      expect.any(String)
    );
  });

  it("combines filters, keeps batches as one card, reconciles new history, and clears filters", async () => {
    await openRegistry();
    expect(container.querySelectorAll(".xp-registry-entry")).toHaveLength(3);
    expect(field("Participating player").textContent).toContain("Retired Hero");
    expect(field("Enemy type").textContent).toContain("Wraith (custom)");
    await change(field("Participating player"), "retired");
    await change(field("Enemy type"), "template:goblin");
    await change(field("From date"), "2026-09-09");
    await change(field("Through date"), "2026-09-09");
    await change(container.querySelector('input[type="search"]')!, "GATE");
    expect(container.querySelectorAll(".xp-registry-entry")).toHaveLength(1);
    expect(container.querySelector(".xp-registry-entry")?.textContent).toContain("5× Goblin");
    expect(container.querySelector('[role="status"]')?.textContent).toBe("1 of 3 records");

    await render(tracker([{ ...goblin, id: "new-batch" }, goblin, custom, orc]));
    expect(container.querySelectorAll(".xp-registry-entry")).toHaveLength(2);
    expect(container.querySelector('[role="status"]')?.textContent).toBe("2 of 4 records");
    expect(sendProtocolRequest).not.toHaveBeenCalled();
    await act(async () => button("Clear filters").click());
    expect(container.querySelectorAll(".xp-registry-entry")).toHaveLength(4);
    expect(container.querySelector('[role="status"]')?.textContent).toBe("4 records");
  });

  it("explains invalid dates and retains a selected enemy after its records are removed", async () => {
    await openRegistry();
    await change(field("From date"), "2026-09-10");
    await change(field("Through date"), "2026-09-09");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "From date must be on or before"
    );
    expect(field("From date").getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelectorAll(".xp-registry-entry")).toHaveLength(0);
    await act(async () => button("Clear filters").click());
    await change(field("Enemy type"), "custom:wraith");
    await render(tracker([goblin, orc]));
    expect(field("Enemy type").value).toBe("custom:wraith");
    expect(field("Enemy type").textContent).toContain("Selected enemy (no records)");
    expect(container.textContent).toContain("No matching kills.");
    await act(async () => button("Clear filters").click());
    expect(container.querySelectorAll(".xp-registry-entry")).toHaveLength(2);
  });

  it("filters only the selected character's supplied history and resets when changing characters", async () => {
    const view = tracker();
    await render(view, "hero");
    expect(container.querySelectorAll(".sheet-kill-card")).toHaveLength(2);
    expect(field("Enemy type").textContent).not.toContain("Orc");
    await change(field("Enemy type"), "custom:wraith");
    expect(container.querySelectorAll(".sheet-kill-card")).toHaveLength(1);
    await render(view, "other");
    expect(field("Enemy type").value).toBe("");
    expect(container.querySelector(".sheet-kill-card")?.textContent).toContain("Orc");
    await render(view, "hero");
    expect(container.querySelectorAll(".sheet-kill-card")).toHaveLength(2);
  });

  it("gives players filters based solely on their supplied records", async () => {
    const view = tracker([goblin, custom]);
    view.can_manage = false;
    view.sheets = view.sheets.filter((sheet) => sheet.instance_id === "hero");
    await render(view, "hero");
    expect(container.textContent).not.toContain("Other Hero");
    expect(field("Participating player").textContent).toContain("Retired Hero");
    await change(field("Enemy type"), "custom:wraith");
    expect(container.querySelectorAll(".sheet-kill-card")).toHaveLength(1);
    expect(container.querySelector(".sheet-kill-card")?.textContent).toContain("Wraith");
  });
});
