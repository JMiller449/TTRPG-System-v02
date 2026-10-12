import { describe, expect, it } from "vitest";
import { initialState } from "@/app/state/initialState";
import {
  itemSigilNodes,
  selectChargedItemSigilActions,
  buildAssignedActionInvocation
} from "./sigilItemActions";

function fixture() {
  const state = structuredClone(initialState);
  state.serverState.actions.spell = {
    id: "spell",
    name: "Fire",
    notes: "",
    steps: [],
    attributes: {}
  };
  state.serverState.items.sword = {
    id: "sword",
    name: "Sword",
    description: "",
    price: "",
    weight: 0,
    interaction_type: "equippable",
    action_grants: [],
    effect_ids: []
  };
  state.serverState.persistentSheets.mage = {
    parent_id: "template",
    health: 10,
    mana: 10,
    augments: {},
    items: {
      copy1: { relationship_id: "copy1", item_id: "sword", count: 1, equipped: true },
      copy2: { relationship_id: "copy2", item_id: "sword", count: 1, equipped: true }
    }
  };
  state.serverState.sigils.sigil = {
    id: "sigil",
    owner_instance_id: "mage",
    item_relationship_id: "copy1",
    nodes: [
      {
        id: "root",
        name: "Flame",
        diameter: 2,
        action_id: "spell",
        charge: {
          action_id: "spell",
          imbuer_instance_id: "mage",
          mana_paid: 4,
          action_signature: "sig"
        }
      }
    ]
  };
  return state;
}

describe("item-attached sigil Actions", () => {
  it("attaches only to the exact item copy and removes the Action after discharge", () => {
    const state = fixture();
    const originalItem = structuredClone(state.serverState.items.sword);
    const originalAction = structuredClone(state.serverState.actions.spell);
    expect(itemSigilNodes(state.serverState.sigils, "mage", "copy2")).toEqual([]);
    const entries = selectChargedItemSigilActions(state, "mage");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      sourceItemRelationshipId: "copy1",
      sigilId: "sigil",
      sigilNodeId: "root"
    });
    expect(selectChargedItemSigilActions(state, "other")).toEqual([]);
    state.serverState.sigils.sigil.nodes[0].charge = null;
    expect(selectChargedItemSigilActions(state, "mage")).toEqual([]);
    expect(itemSigilNodes(state.serverState.sigils, "mage", "copy1")).toHaveLength(1);
    expect(state.serverState.items.sword).toEqual(originalItem);
    expect(state.serverState.actions.spell).toEqual(originalAction);
  });

  it("uses sigil activation with the selected mode/audience rather than ordinary casting", () => {
    const state = fixture();
    const entry = selectChargedItemSigilActions(state, "mage")[0];
    expect(buildAssignedActionInvocation(entry, "mage", "critical", "gm")).toMatchObject({
      type: "activate_sigil",
      sigil_id: "sigil",
      node_id: "root",
      instance_id: "mage",
      roll_mode: "critical",
      visibility: "gm"
    });
    const ordinary = { relationshipId: "ordinary", actionId: "spell", action: entry.action };
    expect(buildAssignedActionInvocation(ordinary, "mage", "normal", "public").type).toBe(
      "perform_action"
    );
  });

  it("withholds attached Actions for missing or stacked inventory references", () => {
    const state = fixture();
    state.serverState.persistentSheets.mage.items!.copy1.count = 2;
    expect(selectChargedItemSigilActions(state, "mage")).toEqual([]);
    delete state.serverState.persistentSheets.mage.items!.copy1;
    expect(selectChargedItemSigilActions(state, "mage")).toEqual([]);
  });
});
