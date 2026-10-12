// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import type { Sheet } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { SigilPlayerAccess } from "./SigilPlayerAccess";

describe("GM sigil player selection", () => {
  it("sends permission changes and reconciles the checkbox to authoritative state", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const state = structuredClone(initialState);
    state.serverState.role = "gm";
    state.serverState.sheets.template = { id: "template", name: "Mage", dm_only: false } as Sheet;
    state.serverState.persistentSheets.mage = {
      parent_id: "template",
      health: 10,
      mana: 10,
      augments: {},
      can_inscribe_sigils: false
    };
    const client = { sendProtocolRequest: vi.fn() } as unknown as GameClient;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const render = async () =>
      act(async () =>
        root.render(
          <StoreContext.Provider value={{ state, dispatch: vi.fn() }}>
            <SigilPlayerAccess client={client} />
          </StoreContext.Provider>
        )
      );
    try {
      await render();
      const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      expect(checkbox.checked).toBe(false);
      await act(async () => checkbox.click());
      expect(client.sendProtocolRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "set_sigil_authoring_access",
          instance_id: "mage",
          enabled: true
        }),
        "Update sigil creation access"
      );
      state.serverState.persistentSheets.mage.can_inscribe_sigils = true;
      await render();
      expect(checkbox.checked).toBe(true);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
