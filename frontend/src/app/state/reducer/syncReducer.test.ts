import { describe, expect, it } from "vitest";
import { initialState } from "@/app/state/initialState";
import { reducer } from "@/app/state/reducer";
import {
  adaptProtocolServerEvent,
  initialSocketProtocolState,
  type SocketProtocolState
} from "@/infrastructure/ws/eventAdapters";
import { parseProtocolServerEvent } from "@/infrastructure/ws/protocol";

function applyAuthoritativeEvent(
  state: typeof initialState,
  protocolState: SocketProtocolState,
  payload: unknown
): { state: typeof initialState; protocolState: SocketProtocolState } {
  const protocolEvent = parseProtocolServerEvent(payload);
  if (!protocolEvent) {
    throw new Error("Expected valid protocol event");
  }

  const adapted = adaptProtocolServerEvent(protocolState, protocolEvent);
  const snapshotEvent = adapted.events[0];
  if (!snapshotEvent || snapshotEvent.type !== "snapshot") {
    throw new Error("Expected snapshot event");
  }

  return {
    state: reducer(state, { type: "apply_snapshot", snapshot: snapshotEvent.snapshot }),
    protocolState: adapted.nextProtocolState
  };
}

describe("authoritative server-state sync", () => {
  it("applies the initial backend snapshot into serverState", () => {
    const result = applyAuthoritativeEvent(initialState, initialSocketProtocolState, {
      response_id: null,
      state: {
        sheets: {},
        instanced_sheets: {},
        items: {
          item_1: {
            id: "item_1",
            name: "Focus Ring",
            description: "Improves mana.",
            price: "120g",
            weight: "1",
            stat_augmentations: []
          }
        },
        actions: {
          action_1: {
            id: "action_1",
            name: "Mana Burst",
            notes: "Burn mana.",
            steps: []
          }
        },
        formulas: {
          formula_1: {
            id: "formula_1",
            formula: {
              aliases: null,
              text: "@arcane * 8"
            }
          }
        },
        proficiencies: {}
      },
      state_version: 0,
      type: "state_snapshot",
      request_id: null
    });

    expect(result.state.serverState.itemOrder).toEqual(["item_1"]);
    expect(result.state.serverState.actionOrder).toEqual(["action_1"]);
    expect(result.state.serverState.formulaOrder).toEqual(["formula_1"]);
  });

  it("applies incremental backend patches against the same authoritative state shape", () => {
    const initial = applyAuthoritativeEvent(initialState, initialSocketProtocolState, {
      response_id: null,
      state: {
        sheets: {},
        instanced_sheets: {},
        items: {},
        actions: {},
        formulas: {},
        proficiencies: {}
      },
      state_version: 0,
      type: "state_snapshot",
      request_id: null
    });

    const result = applyAuthoritativeEvent(initial.state, initial.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/items/item_1",
          value: {
            id: "item_1",
            name: "Focus Ring",
            description: "Improves mana.",
            price: "120g",
            weight: "1",
            stat_augmentations: []
          }
        },
        {
          op: "set",
          path: "/actions/action_1",
          value: {
            id: "action_1",
            name: "Mana Burst",
            notes: "Burn mana.",
            steps: []
          }
        },
        {
          op: "set",
          path: "/formulas/formula_1",
          value: {
            id: "formula_1",
            formula: {
              aliases: null,
              text: "@arcane * 8"
            }
          }
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-1"
    });

    expect(result.state.serverState.items.item_1?.name).toBe("Focus Ring");
    expect(result.state.serverState.actions.action_1?.name).toBe("Mana Burst");
    expect(result.state.serverState.formulas.formula_1?.formula.text).toBe("@arcane * 8");
  });

  it("accepts a forced resync snapshot as the new authoritative source of truth", () => {
    const initial = applyAuthoritativeEvent(initialState, initialSocketProtocolState, {
      response_id: null,
      state: {
        sheets: {},
        instanced_sheets: {},
        items: {
          item_old: {
            id: "item_old",
            name: "Old Item",
            description: "",
            price: "1",
            weight: "1",
            stat_augmentations: []
          }
        },
        actions: {},
        formulas: {},
        proficiencies: {}
      },
      state_version: 0,
      type: "state_snapshot",
      request_id: null
    });

    const result = applyAuthoritativeEvent(initial.state, initial.protocolState, {
      response_id: null,
      state: {
        sheets: {},
        instanced_sheets: {},
        items: {
          item_new: {
            id: "item_new",
            name: "New Item",
            description: "",
            price: "2",
            weight: "1",
            stat_augmentations: []
          }
        },
        actions: {},
        formulas: {},
        proficiencies: {}
      },
      state_version: 2,
      type: "state_snapshot",
      request_id: "req-resync"
    });

    expect(result.state.serverState.items.item_old).toBeUndefined();
    expect(result.state.serverState.items.item_new?.name).toBe("New Item");
    expect(result.state.serverState.itemOrder).toEqual(["item_new"]);
  });
});
