import { describe, expect, it } from "vitest";
import { initialState } from "@/app/state/initialState";
import { reducer } from "@/app/state/reducer";
import {
  selectActiveSheetDetail,
  selectActiveWeaponLabel,
  selectSheetEquipment
} from "@/app/state/selectors";
import {
  adaptProtocolServerEvent,
  initialSocketProtocolState,
  type SocketProtocolState
} from "@/infrastructure/ws/eventAdapters";
import { parseProtocolServerEvent } from "@/infrastructure/ws/protocol";

function formula(text: string) {
  return { aliases: null, text };
}

function stats() {
  return {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    perception: 10,
    arcane: 10,
    will: 10,
    lifting: formula("10"),
    carry_weight: formula("10"),
    acrobatics: formula("10"),
    stamina: formula("10"),
    reaction_time: formula("10"),
    health: formula("100"),
    endurance: formula("10"),
    pain_tolerance: formula("10"),
    sight_distance: formula("10"),
    intuition: formula("10"),
    registration: formula("10"),
    mana: formula("20"),
    control: formula("10"),
    sensitivity: formula("10"),
    charisma: formula("10"),
    mental_fortitude: formula("10"),
    courage: formula("10")
  };
}

function sheet(items = {}) {
  return {
    id: "sheet_1",
    name: "Mage",
    notes: "",
    dm_only: false,
    xp_given_when_slayed: 0,
    xp_cap: "",
    proficiencies: {},
    items,
    stats: stats(),
    resistances: {},
    slayed_record: {},
    actions: {}
  };
}

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

  it("reconciles equipment from authoritative sheet item bridge patches", () => {
    const initial = applyAuthoritativeEvent(initialState, initialSocketProtocolState, {
      response_id: null,
      state: {
        sheets: {
          sheet_1: sheet()
        },
        instanced_sheets: {
          instance_1: {
            parent_id: "sheet_1",
            notes: "",
            health: 100,
            mana: 20,
            resistances: {},
            augments: {}
          }
        },
        items: {
          sword: {
            id: "sword",
            name: "Sword",
            description: "",
            price: "10",
            weight: "3",
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
      ops: [
        {
          op: "add",
          path: "/sheets/sheet_1/items/main_hand",
          value: {
            relationship_id: "main_hand",
            count: 1,
            active: true,
            item_id: "sword"
          }
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-1"
    });

    expect(selectSheetEquipment(result.state, "instance_1")).toEqual([
      {
        relationship_id: "main_hand",
        count: 1,
        active: true,
        item_id: "sword"
      }
    ]);
    expect(selectActiveWeaponLabel(result.state, "instance_1")).toBe("Sword");
  });

  it("uses instance notes when player snapshots omit GM-only template notes", () => {
    const selectedState = reducer(initialState, {
      type: "set_active_sheet_local",
      sheetId: "instance_1"
    });

    const result = applyAuthoritativeEvent(selectedState, initialSocketProtocolState, {
      response_id: null,
      state: {
        sheets: {
          sheet_1: {
            ...sheet(),
            notes: undefined
          }
        },
        instanced_sheets: {
          instance_1: {
            parent_id: "sheet_1",
            notes: "Player-visible instance notes.",
            health: 100,
            mana: 20,
            resistances: {},
            augments: {}
          }
        },
        items: {},
        actions: {},
        formulas: {},
        proficiencies: {}
      },
      state_version: 0,
      type: "state_snapshot",
      request_id: null
    });

    const detail = selectActiveSheetDetail(result.state);
    expect(detail?.sheet?.notes).toBeUndefined();
    expect(detail?.instance.notes).toBe("Player-visible instance notes.");
  });

  it("reconciles current instance resources from authoritative patches", () => {
    const selectedState = reducer(initialState, {
      type: "set_active_sheet_local",
      sheetId: "instance_1"
    });
    const initial = applyAuthoritativeEvent(selectedState, initialSocketProtocolState, {
      response_id: null,
      state: {
        sheets: {
          sheet_1: sheet()
        },
        instanced_sheets: {
          instance_1: {
            parent_id: "sheet_1",
            notes: "",
            health: 100,
            mana: 20,
            resistances: {},
            augments: {}
          }
        },
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
          path: "/instanced_sheets/instance_1/health",
          value: 82
        },
        {
          op: "set",
          path: "/instanced_sheets/instance_1/mana",
          value: 14
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-resource"
    });

    const detail = selectActiveSheetDetail(result.state);
    expect(detail?.persistentSheet.health).toBe(82);
    expect(detail?.persistentSheet.mana).toBe(14);
    expect(detail?.stats.health).toBe(82);
    expect(detail?.stats.mana).toBe(14);
  });

  it("ignores local stat overrides and reconciles base stats from authoritative patches", () => {
    const selectedState = reducer(initialState, {
      type: "set_active_sheet_local",
      sheetId: "instance_1"
    });
    const localOverrideState = reducer(selectedState, {
      type: "set_sheet_stat_overrides",
      sheetId: "instance_1",
      overrides: {
        strength: 99
      }
    });
    const initial = applyAuthoritativeEvent(localOverrideState, initialSocketProtocolState, {
      response_id: null,
      state: {
        sheets: {
          sheet_1: sheet()
        },
        instanced_sheets: {
          instance_1: {
            parent_id: "sheet_1",
            notes: "",
            health: 100,
            mana: 20,
            resistances: {},
            augments: {}
          }
        },
        items: {},
        actions: {},
        formulas: {},
        proficiencies: {}
      },
      state_version: 0,
      type: "state_snapshot",
      request_id: null
    });

    expect(selectActiveSheetDetail(initial.state)?.stats.strength).toBe(10);

    const result = applyAuthoritativeEvent(initial.state, initial.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/sheets/sheet_1/stats/strength",
          value: 14
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-stat"
    });

    expect(selectActiveSheetDetail(result.state)?.stats.strength).toBe(14);
  });
});
