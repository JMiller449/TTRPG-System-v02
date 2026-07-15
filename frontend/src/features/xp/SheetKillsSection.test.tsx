// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import type { AppState } from "@/app/state/types";
import type { ServerEvent, XpTrackerView } from "@/domain/ipc";
import { SheetKillsSection } from "@/features/xp/SheetKillsSection";
import { XpTrackerPage } from "@/features/xp/XpTrackerPage";
import type { GameClient } from "@/hooks/useGameClient";

const tracker: XpTrackerView = {
  can_manage: false,
  sheets: [
    {
      instance_id: "hero_1",
      sheet_id: "hero",
      name: "Hero",
      kills: [],
      adjustments: [],
      current_xp: 0,
      xp_required: 100,
      ready_to_level: false
    }
  ],
  parties: [],
  kills: [],
  adjustments: [],
  mobs: [],
  recordable_mobs: [{ sheet_id: "goblin", name: "Goblin" }]
};

const state: AppState = {
  ...initialState,
  serverState: { ...initialState.serverState, role: "player" },
  uiState: { ...initialState.uiState, xpTracker: tracker }
};

let container: HTMLDivElement;
let root: Root;
let listener: ((event: ServerEvent) => void) | null;
let sendProtocolRequest: ReturnType<typeof vi.fn>;
let client: GameClient;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  listener = null;
  sendProtocolRequest = vi.fn();
  client = {
    connect: async () => undefined,
    disconnect: () => undefined,
    endSession: () => undefined,
    sendProtocolRequest: sendProtocolRequest as GameClient["sendProtocolRequest"],
    authenticate: () => undefined,
    authenticateWithCode: () => undefined,
    onEvent: (nextListener) => {
      listener = nextListener;
      return () => undefined;
    }
  };
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderSection(currentState: AppState = state): Promise<void> {
  await act(async () => {
    root.render(
      <StoreContext.Provider value={{ state: currentState, dispatch: () => undefined }}>
        <SheetKillsSection client={client} instanceId="hero_1" sheetId="hero" />
      </StoreContext.Provider>
    );
    await Promise.resolve();
  });
}

describe("SheetKillsSection player recording", () => {
  it("loads tracker data once without exposing a redundant refresh control", async () => {
    await renderSection();

    expect(sendProtocolRequest).toHaveBeenCalledWith(
      { type: "get_xp_tracker" },
      "Load kill registry"
    );
    expect(
      [...container.querySelectorAll("button")].some((button) => button.textContent === "Refresh")
    ).toBe(false);
  });

  it("renders kill history as compact cards", async () => {
    const kill = {
      id: "kill_1",
      monster_name: "Goblin",
      base_xp: 20,
      participants: [{ instance_id: "hero_1", name: "Hero" }],
      participant_count: 1,
      xp_percentage: 100,
      xp_per_participant: 20,
      occurred_at: "2026-07-14T18:00:00+00:00",
      monster_sheet_id: "goblin",
      notes: "",
      submitted_by_role: "player" as const,
      submitted_by_instance_id: "hero_1",
      submitted_by_name: "Hero"
    };
    await renderSection({
      ...state,
      uiState: {
        ...state.uiState,
        xpTracker: {
          ...tracker,
          kills: [kill],
          sheets: [{ ...tracker.sheets[0], kills: [kill] }]
        }
      }
    });

    expect(container.querySelectorAll(".sheet-kill-card")).toHaveLength(1);
    expect(container.textContent).toContain("Kill history");
    expect(container.textContent).toContain("1 record");
    expect(container.textContent).toContain("20 XP");
    expect(container.textContent).toContain("100% credit");
  });

  it("submits only the selected visible enemy and retains it after an error", async () => {
    await renderSection();
    sendProtocolRequest.mockClear();

    const select = container.querySelector("select");
    const form = container.querySelector("form");
    expect(select).not.toBeNull();
    expect(form).not.toBeNull();
    expect(container.textContent).toContain("Goblin");
    expect(container.textContent).not.toContain("100 XP");

    await act(async () => {
      if (!select || !form) return;
      select.value = "goblin";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    const request = sendProtocolRequest.mock.calls[0]?.[0] as {
      type: string;
      kill_id: string;
      monster_sheet_id: string;
      request_id: string;
      credited_instance_id?: string;
      base_xp?: number;
    };
    expect(request.type).toBe("record_player_kill");
    expect(request.kill_id).toMatch(/^kill_/);
    expect(request.monster_sheet_id).toBe("goblin");
    expect(request.credited_instance_id).toBeUndefined();
    expect(request.base_xp).toBeUndefined();
    expect(select?.disabled).toBe(true);

    await act(async () => {
      listener?.({
        type: "error",
        requestId: request.request_id,
        message: "Enemy is no longer visible."
      });
    });
    expect(select?.disabled).toBe(false);
    expect(select?.value).toBe("goblin");
  });

  it("clears the selection after the matching successful tracker response", async () => {
    await renderSection();
    sendProtocolRequest.mockClear();
    const select = container.querySelector("select");
    const form = container.querySelector("form");

    await act(async () => {
      if (!select || !form) return;
      select.value = "goblin";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    const requestId = sendProtocolRequest.mock.calls[0]?.[0].request_id as string;

    await act(async () => {
      listener?.({ type: "xp_tracker", tracker, requestId });
    });
    expect(select?.value).toBe("");
    expect(select?.disabled).toBe(false);
  });

  it("explains when the DM has not exposed any enemies", async () => {
    await renderSection({
      ...state,
      uiState: {
        ...state.uiState,
        xpTracker: { ...tracker, recordable_mobs: [] }
      }
    });

    expect(container.textContent).toContain("No enemies are currently available to record.");
  });
});

describe("XpTrackerPage player visibility", () => {
  it("lets the DM expose a monster independently from its XP value", async () => {
    const gmTracker: XpTrackerView = {
      ...tracker,
      can_manage: true,
      sheets: [],
      mobs: [
        {
          sheet_id: "goblin",
          name: "Goblin",
          xp_value: 100,
          visible_to_players: false
        }
      ],
      recordable_mobs: []
    };
    const gmState: AppState = {
      ...state,
      serverState: { ...state.serverState, role: "gm", gmAuthenticated: true },
      uiState: { ...state.uiState, xpTracker: gmTracker }
    };

    await act(async () => {
      root.render(
        <StoreContext.Provider value={{ state: gmState, dispatch: () => undefined }}>
          <XpTrackerPage client={client} />
        </StoreContext.Provider>
      );
      await Promise.resolve();
    });
    const progressTab = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "XP Progress"
    );
    await act(async () => progressTab?.click());
    sendProtocolRequest.mockClear();

    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox?.checked).toBe(false);
    await act(async () => checkbox?.click());

    expect(sendProtocolRequest).toHaveBeenCalledWith(
      {
        type: "set_mob_kill_visibility",
        mob_sheet_id: "goblin",
        visible: true
      },
      "Show player kill option: Goblin"
    );
    expect(container.textContent).toContain("XP per kill");
  });
});
