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
            augmentation_templates: []
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
        condition_presets: {
          poisoned: {
            id: "poisoned",
            name: "Poisoned",
            description: "Poison status.",
            visibility: "public",
            augmentation_ids: [],
            augmentation_templates: []
          }
        },
        proficiencies: {},
        action_history: {
          history_1: {
            id: "history_1",
            request_id: "request_1",
            action_id: "action_1",
            action_name: "Mana Burst",
            actor_role: "player",
            actor_sheet_id: "sheet_1",
            actor_instance_id: "instance_1",
            target_sheet_id: null,
            created_at: "2026-06-18T12:00:00Z",
            state_version: 1,
            status: "success",
            summary: "Mana Burst succeeded.",
            emitted_messages: ["Mana Burst"],
            mutation_summaries: [],
            formula_summaries: [],
            error: null,
            redacted: true
          }
        }
      },
      state_version: 0,
      type: "state_snapshot",
      request_id: null
    });

    expect(result.state.serverState.itemOrder).toEqual(["item_1"]);
    expect(result.state.serverState.actionOrder).toEqual(["action_1"]);
    expect(result.state.serverState.formulaOrder).toEqual(["formula_1"]);
    expect(result.state.serverState.conditionPresetOrder).toEqual(["poisoned"]);
    expect(result.state.serverState.conditionPresets.poisoned.name).toBe("Poisoned");
    expect(result.state.serverState.actionHistoryOrder).toEqual(["history_1"]);
    expect(result.state.serverState.actionHistory.history_1.summary).toBe("Mana Burst succeeded.");
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
            augmentation_templates: []
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

  it("reconciles item create, edit, and delete patches from the authoritative backend state", () => {
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

    const created = applyAuthoritativeEvent(initial.state, initial.protocolState, {
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
            augmentation_templates: []
          }
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-create-item"
    });

    expect(created.state.serverState.items.item_1?.name).toBe("Focus Ring");
    expect(created.state.serverState.itemOrder).toEqual(["item_1"]);

    const edited = applyAuthoritativeEvent(created.state, created.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/items/item_1/name",
          value: "Edited Focus Ring"
        },
        {
          op: "set",
          path: "/items/item_1/gm_notes",
          value: "Award after the mana trial."
        }
      ],
      state_version: 2,
      type: "state_patch",
      request_id: "req-update-item"
    });

    expect(edited.state.serverState.items.item_1?.name).toBe("Edited Focus Ring");
    expect(edited.state.serverState.items.item_1?.gm_notes).toBe("Award after the mana trial.");
    expect(edited.state.serverState.itemOrder).toEqual(["item_1"]);

    const deleted = applyAuthoritativeEvent(edited.state, edited.protocolState, {
      response_id: null,
      ops: [
        {
          op: "remove",
          path: "/items/item_1"
        }
      ],
      state_version: 3,
      type: "state_patch",
      request_id: "req-delete-item"
    });

    expect(deleted.state.serverState.items.item_1).toBeUndefined();
    expect(deleted.state.serverState.itemOrder).toEqual([]);
  });

  it("reconciles formula create, edit, and delete patches from the authoritative backend state", () => {
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

    const created = applyAuthoritativeEvent(initial.state, initial.protocolState, {
      response_id: null,
      ops: [
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
      request_id: "req-create-formula"
    });

    expect(created.state.serverState.formulas.formula_1?.formula.text).toBe("@arcane * 8");
    expect(created.state.serverState.formulaOrder).toEqual(["formula_1"]);

    const edited = applyAuthoritativeEvent(created.state, created.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/formulas/formula_1/formula/text",
          value: "@arcane * 10"
        }
      ],
      state_version: 2,
      type: "state_patch",
      request_id: "req-update-formula"
    });

    expect(edited.state.serverState.formulas.formula_1?.formula.text).toBe("@arcane * 10");
    expect(edited.state.serverState.formulaOrder).toEqual(["formula_1"]);

    const deleted = applyAuthoritativeEvent(edited.state, edited.protocolState, {
      response_id: null,
      ops: [
        {
          op: "remove",
          path: "/formulas/formula_1"
        }
      ],
      state_version: 3,
      type: "state_patch",
      request_id: "req-delete-formula"
    });

    expect(deleted.state.serverState.formulas.formula_1).toBeUndefined();
    expect(deleted.state.serverState.formulaOrder).toEqual([]);
  });

  it("reconciles action create, edit, and delete patches from the authoritative backend state", () => {
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

    const created = applyAuthoritativeEvent(initial.state, initial.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/actions/action_1",
          value: {
            id: "action_1",
            name: "Mana Burst",
            notes: "Roll20 output.",
            steps: [
              {
                step_id: "step_message",
                type: "send_message",
                message: {
                  aliases: null,
                  text: "/em releases a mana burst."
                }
              }
            ]
          }
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-create-action"
    });

    expect(created.state.serverState.actions.action_1?.name).toBe("Mana Burst");
    expect(created.state.serverState.actions.action_1?.steps?.[0]?.type).toBe("send_message");
    expect(created.state.serverState.actionOrder).toEqual(["action_1"]);

    const edited = applyAuthoritativeEvent(created.state, created.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/actions/action_1/name",
          value: "Edited Mana Burst"
        },
        {
          op: "set",
          path: "/actions/action_1/steps/0/message/text",
          value: "/em releases an edited mana burst."
        }
      ],
      state_version: 2,
      type: "state_patch",
      request_id: "req-update-action"
    });

    expect(edited.state.serverState.actions.action_1?.name).toBe("Edited Mana Burst");
    const editedStep = edited.state.serverState.actions.action_1?.steps?.[0];
    expect(editedStep?.type).toBe("send_message");
    if (editedStep?.type === "send_message") {
      expect(editedStep.message.text).toBe("/em releases an edited mana burst.");
    }
    expect(edited.state.serverState.actionOrder).toEqual(["action_1"]);

    const deleted = applyAuthoritativeEvent(edited.state, edited.protocolState, {
      response_id: null,
      ops: [
        {
          op: "remove",
          path: "/actions/action_1"
        }
      ],
      state_version: 3,
      type: "state_patch",
      request_id: "req-delete-action"
    });

    expect(deleted.state.serverState.actions.action_1).toBeUndefined();
    expect(deleted.state.serverState.actionOrder).toEqual([]);
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
            augmentation_templates: []
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
            augmentation_templates: []
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
            augmentation_templates: []
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
