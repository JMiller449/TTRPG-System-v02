import { describe, expect, it } from "vitest";
import { initialState } from "@/app/state/initialState";
import { canAuthorSigils, canOpenSigils } from "./sigilAccess";
import { getConsoleSidebarNavGroups } from "@/features/console/consoleSidebarData";

describe("sigil player visibility", () => {
  it("hides sigil navigation until authoring is granted or a sigil is shared", () => {
    const state = structuredClone(initialState);
    state.serverState.role = "player";
    state.uiState.activeSheetId = "mage";
    state.serverState.persistentSheets.mage = {
      parent_id: "template",
      health: 10,
      mana: 10,
      augments: {}
    };
    const navigation = () =>
      getConsoleSidebarNavGroups("player", canOpenSigils(state)).flatMap((group) =>
        group.items.map((item) => item.view)
      );
    expect(canAuthorSigils(state)).toBe(false);
    expect(navigation()).not.toContain("sigils");
    state.serverState.persistentSheets.mage.can_inscribe_sigils = true;
    expect(canAuthorSigils(state)).toBe(true);
    expect(navigation()).toContain("sigils");
    state.serverState.persistentSheets.mage.can_inscribe_sigils = false;
    state.serverState.sigils.shared = {
      id: "shared",
      owner_instance_id: "other",
      nodes: [{ id: "root", name: "Root", diameter: 1 }]
    };
    expect(canAuthorSigils(state)).toBe(false);
    expect(navigation()).toContain("sigils");
    state.serverState.sigils = {};
    expect(navigation()).not.toContain("sigils");
  });
});
