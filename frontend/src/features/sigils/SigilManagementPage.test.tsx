// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import type { GameClient } from "@/hooks/useGameClient";
import type { ServerEvent } from "@/domain/ipc";
import { SigilManagementPage } from "./SigilManagementPage";

describe("Sigil Management", () => {
  it("submits activation with the selected character and renders server charge transitions", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const state = structuredClone(initialState);
    state.serverState.role = "player";
    state.uiState.activeSheetId = "activator";
    state.serverState.sigils.sigil = {
      id: "sigil",
      owner_instance_id: "imbuer",
      revision: 1,
      access_instance_ids: ["activator"],
      nodes: [
        {
          id: "root",
          name: "Fire sigil",
          diameter: 2,
          action_id: "fire",
          mana_cost_step_ids: ["cost"],
          power_step_ids: ["roll"],
          charge: {
            action_id: "fire",
            imbuer_instance_id: "imbuer",
            action_signature: "sig",
            mana_paid: 8
          },
          last_imbuer_instance_id: "imbuer"
        }
      ]
    };
    const listeners = new Set<(event: ServerEvent) => void>();
    const client = {
      sendProtocolRequest: vi.fn(),
      onEvent: (listener: (event: ServerEvent) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    } as unknown as GameClient;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const render = async () =>
      act(async () =>
        root.render(
          <StoreContext.Provider value={{ state, dispatch: vi.fn() }}>
            <SigilManagementPage client={client} />
          </StoreContext.Provider>
        )
      );
    const button = (name: string) =>
      Array.from(container.querySelectorAll("button")).find(
        (element) => element.textContent === name
      )!;
    try {
      await render();
      await act(async () => button("Fire sigil · 1 charged").click());
      expect(container.textContent).toContain("Last imbuer: imbuer");
      expect(container.textContent).not.toContain("Create sigil");
      expect(container.textContent).not.toContain("Save configuration");
      expect(container.textContent).not.toContain("Diameter in meters (required)");
      await act(async () => button("Activate").click());
      expect(client.sendProtocolRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "activate_sigil",
          instance_id: "activator",
          sigil_id: "sigil",
          node_id: "root"
        }),
        "Activate sigil"
      );
      state.serverState.sigils = {
        sigil: {
          ...state.serverState.sigils.sigil,
          revision: 2,
          nodes: [{ ...state.serverState.sigils.sigil.nodes[0], charge: null }]
        }
      };
      await render();
      expect(container.textContent).toContain("Status: Uncharged");
      expect(button("Activate").disabled).toBe(true);
      expect(button("Recharge").disabled).toBe(false);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("shows creation only while the claimed character has GM-granted permission", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const state = structuredClone(initialState);
    state.serverState.role = "player";
    state.uiState.activeSheetId = "mage";
    state.serverState.persistentSheets.mage = {
      parent_id: "template",
      health: 10,
      mana: 10,
      augments: {},
      can_inscribe_sigils: false
    };
    const client = {
      sendProtocolRequest: vi.fn(),
      onEvent: () => () => undefined
    } as unknown as GameClient;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const render = async () =>
      act(async () =>
        root.render(
          <StoreContext.Provider value={{ state, dispatch: vi.fn() }}>
            <SigilManagementPage client={client} />
          </StoreContext.Provider>
        )
      );
    try {
      await render();
      expect(container.textContent).not.toContain("Sigil Management");
      state.serverState.persistentSheets.mage.can_inscribe_sigils = true;
      await render();
      const create = Array.from(container.querySelectorAll("button")).find(
        (element) => element.textContent === "Create sigil"
      )!;
      expect(create).toBeDefined();
      await act(async () => create.click());
      expect(container.textContent).toContain("Save configuration");
      state.serverState.persistentSheets.mage.can_inscribe_sigils = false;
      await render();
      expect(container.textContent).not.toContain("Create sigil");
      expect(container.textContent).not.toContain("Save configuration");
      expect(client.sendProtocolRequest).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
