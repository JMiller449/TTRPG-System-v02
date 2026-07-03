import { describe, expect, it } from "vitest";
import { initialState } from "@/app/state/initialState";
import { reducer } from "@/app/state/reducer";
import {
  selectActiveSheetDetail,
  selectSheetAssignedActions,
  selectSheetEquipment
} from "@/app/state/selectors";
import { selectActiveEquipmentEffects } from "@/features/sheets/equipmentDisplay";
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

function augmentationTemplate({ id = "aug_1", name = "Arcane Guard", value = "2" } = {}) {
  return {
    id,
    name,
    description: "Raises current health.",
    source: {
      type: "item",
      id: "item_1",
      label: "Focus Ring"
    },
    scope: "instance",
    target: {
      root: "instance",
      path: ["health"]
    },
    effect: {
      type: "formula_modifier",
      operation: "add",
      value: {
        aliases: null,
        text: value
      }
    },
    active: true,
    applied: false,
    applied_target_id: null,
    lifecycle: {
      duration: "",
      expires_at: "",
      removal_condition: ""
    }
  };
}

function actionHistoryEntry({
  id = "history_1",
  summary = "Mana Burst succeeded.",
  version = 1
} = {}) {
  return {
    id,
    request_id: `request_${id}`,
    action_id: "action_1",
    action_name: "Mana Burst",
    actor_role: "dm",
    actor_sheet_id: "sheet_1",
    actor_instance_id: "instance_1",
    target_sheet_id: null,
    created_at: "2026-06-18T12:00:00Z",
    state_version: version,
    status: "success",
    summary,
    emitted_messages: ["Mana Burst"],
    mutation_summaries: [],
    formula_summaries: [],
    error: null,
    redacted: false
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
        facts: {
          amount_of_reactions: {
            id: "amount_of_reactions",
            name: "Amount of Reactions",
            description: "Informational reaction amount.",
            subject_types: ["sheet"],
            value_type: "number",
            default_value: {
              type: "formula",
              formula: { aliases: null, text: "1" }
            },
            unit: "reactions",
            visibility: "public",
            required: true
          }
        },
        augmentations: {
          aug_1: augmentationTemplate()
        },
        encounter_presets: {
          encounter_1: {
            id: "encounter_1",
            name: "Two Mages",
            entries: [
              {
                template_id: "sheet_1",
                count: 2
              }
            ],
            updated_at: "2026-06-19T00:00:00+00:00"
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
    expect(result.state.serverState.factOrder).toEqual(["amount_of_reactions"]);
    expect(result.state.serverState.facts.amount_of_reactions?.required).toBe(true);
    expect(result.state.serverState.augmentationOrder).toEqual(["aug_1"]);
    expect(result.state.serverState.augmentations.aug_1?.name).toBe("Arcane Guard");
    expect(result.state.serverState.encounterOrder).toEqual(["encounter_1"]);
    expect(result.state.serverState.encounters.encounter_1).toEqual({
      id: "encounter_1",
      name: "Two Mages",
      entries: [
        {
          templateId: "sheet_1",
          count: 2
        }
      ],
      updatedAt: "2026-06-19T00:00:00+00:00"
    });
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

  it("reconciles encounter preset save, edit, and delete patches from the authoritative backend state", () => {
    const initial = applyAuthoritativeEvent(initialState, initialSocketProtocolState, {
      response_id: null,
      state: {
        sheets: {},
        instanced_sheets: {},
        items: {},
        actions: {},
        formulas: {},
        proficiencies: {},
        encounter_presets: {}
      },
      state_version: 0,
      type: "state_snapshot",
      request_id: null
    });

    const created = applyAuthoritativeEvent(initial.state, initial.protocolState, {
      response_id: null,
      ops: [
        {
          op: "add",
          path: "/encounter_presets/encounter_1",
          value: {
            id: "encounter_1",
            name: "Two Mages",
            entries: [
              {
                template_id: "sheet_1",
                count: 2
              }
            ],
            updated_at: "2026-06-19T00:00:00+00:00"
          }
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-save-encounter"
    });

    expect(created.state.serverState.encounterOrder).toEqual(["encounter_1"]);
    expect(created.state.serverState.encounters.encounter_1?.entries).toEqual([
      {
        templateId: "sheet_1",
        count: 2
      }
    ]);

    const edited = applyAuthoritativeEvent(created.state, created.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/encounter_presets/encounter_1/name",
          value: "Three Mages"
        },
        {
          op: "set",
          path: "/encounter_presets/encounter_1/entries",
          value: [
            {
              template_id: "sheet_1",
              count: 3
            }
          ]
        }
      ],
      state_version: 2,
      type: "state_patch",
      request_id: "req-update-encounter"
    });

    expect(edited.state.serverState.encounters.encounter_1?.name).toBe("Three Mages");
    expect(edited.state.serverState.encounters.encounter_1?.entries).toEqual([
      {
        templateId: "sheet_1",
        count: 3
      }
    ]);
    expect(edited.state.serverState.encounterOrder).toEqual(["encounter_1"]);

    const deleted = applyAuthoritativeEvent(edited.state, edited.protocolState, {
      response_id: null,
      ops: [
        {
          op: "remove",
          path: "/encounter_presets/encounter_1"
        }
      ],
      state_version: 3,
      type: "state_patch",
      request_id: "req-delete-encounter"
    });

    expect(deleted.state.serverState.encounters.encounter_1).toBeUndefined();
    expect(deleted.state.serverState.encounterOrder).toEqual([]);
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
    if (editedStep?.type === "send_message" && !("type" in editedStep.message)) {
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

  it("reconciles Fact definitions and sheet, item, and action Fact bridges", () => {
    const initial = applyAuthoritativeEvent(initialState, initialSocketProtocolState, {
      response_id: null,
      state: {
        sheets: {
          sheet_1: { ...sheet(), facts: {} }
        },
        instanced_sheets: {},
        items: {
          item_1: {
            id: "item_1",
            name: "Focus Ring",
            interaction_type: "equippable",
            description: "Improves mana.",
            price: "120g",
            weight: "1",
            augmentation_templates: [],
            facts: {}
          }
        },
        actions: {
          action_1: {
            id: "action_1",
            name: "Mana Burst",
            notes: "Burn mana.",
            steps: [],
            facts: {}
          }
        },
        formulas: {},
        facts: {},
        proficiencies: {}
      },
      state_version: 0,
      type: "state_snapshot",
      request_id: null
    });

    const factDefinition = {
      id: "rank_label",
      name: "Rank Label",
      subject_types: ["sheet", "item", "action"],
      value_type: "text",
      default_value: { type: "text", value: "F" },
      visibility: "public"
    };
    const factBridge = (relationshipId: string, value: string) => ({
      relationship_id: relationshipId,
      fact_id: "rank_label",
      value: { type: "text", value },
      evaluated_value: value,
      evaluation_error: null
    });

    const attached = applyAuthoritativeEvent(initial.state, initial.protocolState, {
      response_id: null,
      ops: [
        { op: "set", path: "/facts/rank_label", value: factDefinition },
        {
          op: "set",
          path: "/sheets/sheet_1/facts/rank_label",
          value: factBridge("sheet-rank", "C")
        },
        {
          op: "set",
          path: "/items/item_1/facts/rank_label",
          value: factBridge("item-rank", "D")
        },
        {
          op: "set",
          path: "/actions/action_1/facts/rank_label",
          value: factBridge("action-rank", "A")
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-attach-facts"
    });

    expect(attached.state.serverState.factOrder).toEqual(["rank_label"]);
    expect(attached.state.serverState.sheets.sheet_1?.facts?.rank_label.evaluated_value).toBe("C");
    expect(attached.state.serverState.items.item_1?.facts?.rank_label.evaluated_value).toBe("D");
    expect(attached.state.serverState.actions.action_1?.facts?.rank_label.evaluated_value).toBe(
      "A"
    );

    const detached = applyAuthoritativeEvent(attached.state, attached.protocolState, {
      response_id: null,
      ops: [
        { op: "remove", path: "/sheets/sheet_1/facts/rank_label" },
        { op: "remove", path: "/items/item_1/facts/rank_label" },
        { op: "remove", path: "/actions/action_1/facts/rank_label" },
        { op: "remove", path: "/facts/rank_label" }
      ],
      state_version: 2,
      type: "state_patch",
      request_id: "req-detach-facts"
    });

    expect(detached.state.serverState.factOrder).toEqual([]);
    expect(detached.state.serverState.sheets.sheet_1?.facts?.rank_label).toBeUndefined();
    expect(detached.state.serverState.items.item_1?.facts?.rank_label).toBeUndefined();
    expect(detached.state.serverState.actions.action_1?.facts?.rank_label).toBeUndefined();
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

  it("reconciles sheet root create, nested update, and delete patches from authoritative backend state", () => {
    const selectedState = reducer(initialState, {
      type: "set_active_sheet_local",
      sheetId: "instance_1"
    });
    const initial = applyAuthoritativeEvent(selectedState, initialSocketProtocolState, {
      response_id: null,
      state: {
        sheets: {},
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

    const created = applyAuthoritativeEvent(initial.state, initial.protocolState, {
      response_id: null,
      ops: [
        {
          op: "add",
          path: "/sheets/sheet_1",
          value: sheet()
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-create-sheet"
    });

    expect(created.state.serverState.sheetOrder).toEqual(["sheet_1"]);
    expect(created.state.serverState.sheets.sheet_1?.name).toBe("Mage");
    expect(selectActiveSheetDetail(created.state)?.sheet?.id).toBe("sheet_1");

    const edited = applyAuthoritativeEvent(created.state, created.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/sheets/sheet_1/name",
          value: "Edited Mage"
        },
        {
          op: "set",
          path: "/sheets/sheet_1/notes",
          value: "Edited template notes."
        }
      ],
      state_version: 2,
      type: "state_patch",
      request_id: "req-update-sheet"
    });

    expect(edited.state.serverState.sheets.sheet_1?.name).toBe("Edited Mage");
    expect(edited.state.serverState.sheets.sheet_1?.notes).toBe("Edited template notes.");
    expect(edited.state.serverState.sheetOrder).toEqual(["sheet_1"]);

    const deleted = applyAuthoritativeEvent(edited.state, edited.protocolState, {
      response_id: null,
      ops: [
        {
          op: "remove",
          path: "/sheets/sheet_1"
        }
      ],
      state_version: 3,
      type: "state_patch",
      request_id: "req-delete-sheet"
    });

    expect(deleted.state.serverState.sheets.sheet_1).toBeUndefined();
    expect(deleted.state.serverState.sheetOrder).toEqual([]);
    expect(selectActiveSheetDetail(deleted.state)?.sheet).toBeNull();
    expect(deleted.state.uiState.activeSheetId).toBe("instance_1");
  });

  it("reconciles instanced sheet root create, nested update, and delete patches from authoritative backend state", () => {
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

    expect(initial.state.uiState.activeSheetId).toBeNull();

    const selectedAfterSnapshot = reducer(initial.state, {
      type: "set_active_sheet_local",
      sheetId: "instance_1"
    });
    const created = applyAuthoritativeEvent(selectedAfterSnapshot, initial.protocolState, {
      response_id: null,
      ops: [
        {
          op: "add",
          path: "/instanced_sheets/instance_1",
          value: {
            parent_id: "sheet_1",
            notes: "",
            health: 100,
            mana: 20,
            resistances: {},
            augments: {}
          }
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-create-instance"
    });

    expect(created.state.serverState.persistentSheetOrder).toEqual(["instance_1"]);
    expect(created.state.serverState.persistentSheets.instance_1?.health).toBe(100);
    expect(created.state.uiState.activeSheetId).toBe("instance_1");

    const edited = applyAuthoritativeEvent(created.state, created.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/instanced_sheets/instance_1/notes",
          value: "Edited instance notes."
        },
        {
          op: "set",
          path: "/instanced_sheets/instance_1/health",
          value: 77
        }
      ],
      state_version: 2,
      type: "state_patch",
      request_id: "req-update-instance"
    });

    expect(edited.state.serverState.persistentSheets.instance_1?.notes).toBe(
      "Edited instance notes."
    );
    expect(edited.state.serverState.persistentSheets.instance_1?.health).toBe(77);
    expect(selectActiveSheetDetail(edited.state)?.instance.notes).toBe("Edited instance notes.");

    const deleted = applyAuthoritativeEvent(edited.state, edited.protocolState, {
      response_id: null,
      ops: [
        {
          op: "remove",
          path: "/instanced_sheets/instance_1"
        }
      ],
      state_version: 3,
      type: "state_patch",
      request_id: "req-delete-instance"
    });

    expect(deleted.state.serverState.persistentSheets.instance_1).toBeUndefined();
    expect(deleted.state.serverState.persistentSheetOrder).toEqual([]);
    expect(deleted.state.uiState.activeSheetId).toBeNull();
    expect(deleted.state.uiState.playerSheetSelectionComplete).toBe(false);
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
            interaction_type: "equippable",
            description: "",
            price: "10",
            weight: "3",
            augmentation_templates: []
          }
        },
        augmentations: {},
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
          op: "add",
          path: "/sheets/sheet_1/items/main_hand",
          value: {
            relationship_id: "main_hand",
            count: 1,
            equipped: true,
            item_id: "sword"
          }
        },
        {
          op: "add",
          path: "/augmentations/equipment:main_hand",
          value: {
            ...augmentationTemplate({ id: "equipment:main_hand" }),
            source: {
              type: "item",
              id: "sword",
              label: "Sword",
              relationship_id: "main_hand",
              application_id: "equipment:sheet_1:main_hand"
            },
            lifecycle_owner: "equipment",
            applied: true,
            applied_target_id: "instance_1"
          }
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-1"
    });

    expect(selectSheetEquipment(created.state, "instance_1")).toEqual([
      {
        relationship_id: "main_hand",
        count: 1,
        equipped: true,
        item_id: "sword"
      }
    ]);
    expect(
      selectActiveEquipmentEffects(created.state.serverState.augmentations, "main_hand").map(
        (augmentation) => augmentation.id
      )
    ).toEqual(["equipment:main_hand"]);

    const edited = applyAuthoritativeEvent(created.state, created.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/sheets/sheet_1/items/main_hand/count",
          value: 2
        },
        {
          op: "set",
          path: "/sheets/sheet_1/items/main_hand/equipped",
          value: false
        },
        {
          op: "remove",
          path: "/augmentations/equipment:main_hand"
        }
      ],
      state_version: 2,
      type: "state_patch",
      request_id: "req-update-item-bridge"
    });

    expect(selectSheetEquipment(edited.state, "instance_1")).toEqual([
      {
        relationship_id: "main_hand",
        count: 2,
        equipped: false,
        item_id: "sword"
      }
    ]);
    expect(
      selectActiveEquipmentEffects(edited.state.serverState.augmentations, "main_hand")
    ).toEqual([]);

    const deleted = applyAuthoritativeEvent(edited.state, edited.protocolState, {
      response_id: null,
      ops: [
        {
          op: "remove",
          path: "/sheets/sheet_1/items/main_hand"
        }
      ],
      state_version: 3,
      type: "state_patch",
      request_id: "req-delete-item-bridge"
    });

    expect(selectSheetEquipment(deleted.state, "instance_1")).toEqual([]);
  });

  it("reconciles assigned actions from authoritative sheet action bridge patches", () => {
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
        items: {},
        actions: {
          action_1: {
            id: "action_1",
            name: "Attack",
            notes: "",
            steps: []
          },
          action_2: {
            id: "action_2",
            name: "Power Attack",
            notes: "",
            steps: []
          }
        },
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
          op: "add",
          path: "/sheets/sheet_1/actions/default_attack",
          value: {
            relationship_id: "default_attack",
            entry_id: "action_1"
          }
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-create-action-bridge"
    });

    expect(selectSheetAssignedActions(created.state, "instance_1")).toEqual([
      {
        relationshipId: "default_attack",
        actionId: "action_1",
        action: {
          id: "action_1",
          name: "Attack",
          notes: "",
          steps: []
        },
        bridge: {
          relationship_id: "default_attack",
          entry_id: "action_1"
        }
      }
    ]);

    const edited = applyAuthoritativeEvent(created.state, created.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/sheets/sheet_1/actions/default_attack/entry_id",
          value: "action_2"
        }
      ],
      state_version: 2,
      type: "state_patch",
      request_id: "req-update-action-bridge"
    });

    expect(selectSheetAssignedActions(edited.state, "instance_1")[0]?.action.name).toBe(
      "Power Attack"
    );

    const deleted = applyAuthoritativeEvent(edited.state, edited.protocolState, {
      response_id: null,
      ops: [
        {
          op: "remove",
          path: "/sheets/sheet_1/actions/default_attack"
        }
      ],
      state_version: 3,
      type: "state_patch",
      request_id: "req-delete-action-bridge"
    });

    expect(selectSheetAssignedActions(deleted.state, "instance_1")).toEqual([]);
  });

  it("reconciles sheet proficiency bridge patches from authoritative backend state", () => {
    const initial = applyAuthoritativeEvent(initialState, initialSocketProtocolState, {
      response_id: null,
      state: {
        sheets: {
          sheet_1: sheet()
        },
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
          op: "add",
          path: "/sheets/sheet_1/proficiencies/longsword",
          value: {
            relationship_id: "longsword",
            prof_id: "prof_longsword",
            use_count: 2,
            growth_rate: 0.5
          }
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-create-proficiency-bridge"
    });

    expect(created.state.serverState.sheets.sheet_1?.proficiencies.longsword).toEqual({
      relationship_id: "longsword",
      prof_id: "prof_longsword",
      use_count: 2,
      growth_rate: 0.5
    });

    const edited = applyAuthoritativeEvent(created.state, created.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/sheets/sheet_1/proficiencies/longsword/use_count",
          value: 3
        },
        {
          op: "set",
          path: "/sheets/sheet_1/proficiencies/longsword/growth_rate",
          value: 0.75
        }
      ],
      state_version: 2,
      type: "state_patch",
      request_id: "req-update-proficiency-bridge"
    });

    expect(edited.state.serverState.sheets.sheet_1?.proficiencies.longsword?.use_count).toBe(3);
    expect(edited.state.serverState.sheets.sheet_1?.proficiencies.longsword?.growth_rate).toBe(
      0.75
    );

    const deleted = applyAuthoritativeEvent(edited.state, edited.protocolState, {
      response_id: null,
      ops: [
        {
          op: "remove",
          path: "/sheets/sheet_1/proficiencies/longsword"
        }
      ],
      state_version: 3,
      type: "state_patch",
      request_id: "req-delete-proficiency-bridge"
    });

    expect(deleted.state.serverState.sheets.sheet_1?.proficiencies.longsword).toBeUndefined();
  });

  it("reconciles global proficiency definition patches from authoritative backend state", () => {
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
          op: "add",
          path: "/proficiencies/longsword",
          value: {
            id: "longsword",
            name: "Longsword",
            description: "Tracks approved longsword use."
          }
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-create-proficiency"
    });

    expect(created.state.serverState.proficiencies.longsword).toEqual({
      id: "longsword",
      name: "Longsword",
      description: "Tracks approved longsword use."
    });
    expect(created.state.serverState.proficiencyOrder).toEqual(["longsword"]);

    const edited = applyAuthoritativeEvent(created.state, created.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/proficiencies/longsword/name",
          value: "Longsword Mastery"
        }
      ],
      state_version: 2,
      type: "state_patch",
      request_id: "req-update-proficiency"
    });

    expect(edited.state.serverState.proficiencies.longsword?.name).toBe("Longsword Mastery");

    const deleted = applyAuthoritativeEvent(edited.state, edited.protocolState, {
      response_id: null,
      ops: [
        {
          op: "remove",
          path: "/proficiencies/longsword"
        }
      ],
      state_version: 3,
      type: "state_patch",
      request_id: "req-delete-proficiency"
    });

    expect(deleted.state.serverState.proficiencies.longsword).toBeUndefined();
    expect(deleted.state.serverState.proficiencyOrder).toEqual([]);
  });

  it("reconciles condition preset create, edit, and delete patches from authoritative backend state", () => {
    const initial = applyAuthoritativeEvent(initialState, initialSocketProtocolState, {
      response_id: null,
      state: {
        sheets: {},
        instanced_sheets: {},
        items: {},
        actions: {},
        formulas: {},
        proficiencies: {},
        condition_presets: {}
      },
      state_version: 0,
      type: "state_snapshot",
      request_id: null
    });

    const created = applyAuthoritativeEvent(initial.state, initial.protocolState, {
      response_id: null,
      ops: [
        {
          op: "add",
          path: "/condition_presets/poisoned",
          value: {
            id: "poisoned",
            name: "Poisoned",
            description: "Poison status.",
            visibility: "public",
            augmentation_ids: ["aug_1"],
            augmentation_templates: [augmentationTemplate()]
          }
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-create-condition"
    });

    expect(created.state.serverState.conditionPresetOrder).toEqual(["poisoned"]);
    expect(
      created.state.serverState.conditionPresets.poisoned?.augmentation_templates?.[0]?.id
    ).toBe("aug_1");

    const edited = applyAuthoritativeEvent(created.state, created.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/condition_presets/poisoned/name",
          value: "Severe Poison"
        },
        {
          op: "set",
          path: "/condition_presets/poisoned/visibility",
          value: "gm_only"
        }
      ],
      state_version: 2,
      type: "state_patch",
      request_id: "req-update-condition"
    });

    expect(edited.state.serverState.conditionPresets.poisoned?.name).toBe("Severe Poison");
    expect(edited.state.serverState.conditionPresets.poisoned?.visibility).toBe("gm_only");
    expect(edited.state.serverState.conditionPresetOrder).toEqual(["poisoned"]);

    const deleted = applyAuthoritativeEvent(edited.state, edited.protocolState, {
      response_id: null,
      ops: [
        {
          op: "remove",
          path: "/condition_presets/poisoned"
        }
      ],
      state_version: 3,
      type: "state_patch",
      request_id: "req-delete-condition"
    });

    expect(deleted.state.serverState.conditionPresets.poisoned).toBeUndefined();
    expect(deleted.state.serverState.conditionPresetOrder).toEqual([]);
  });

  it("reconciles active condition applications from snapshots and patches", () => {
    const initial = applyAuthoritativeEvent(initialState, initialSocketProtocolState, {
      response_id: null,
      state: {
        sheets: {},
        instanced_sheets: {},
        items: {},
        actions: {},
        formulas: {},
        proficiencies: {},
        condition_presets: {},
        active_conditions: {}
      },
      state_version: 0,
      type: "state_snapshot",
      request_id: null
    });

    const applicationId = "condition:poisoned:instance_1";
    const applied = applyAuthoritativeEvent(initial.state, initial.protocolState, {
      response_id: null,
      ops: [
        {
          op: "add",
          path: `/active_conditions/${applicationId}`,
          value: {
            application_id: applicationId,
            condition_id: "poisoned",
            condition_name: "Poisoned",
            description: "Ongoing poison.",
            visibility: "public",
            instance_id: "instance_1",
            augmentation_ids: ["poison-drain"]
          }
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "apply-condition"
    });

    expect(applied.state.serverState.activeConditionOrder).toEqual([applicationId]);
    expect(applied.state.serverState.activeConditions[applicationId]?.condition_name).toBe(
      "Poisoned"
    );

    const removed = applyAuthoritativeEvent(applied.state, applied.protocolState, {
      response_id: null,
      ops: [{ op: "remove", path: `/active_conditions/${applicationId}` }],
      state_version: 2,
      type: "state_patch",
      request_id: "remove-condition"
    });

    expect(removed.state.serverState.activeConditions[applicationId]).toBeUndefined();
    expect(removed.state.serverState.activeConditionOrder).toEqual([]);
  });

  it("reconciles item augmentation template upsert and remove patches from authoritative backend state", () => {
    const initial = applyAuthoritativeEvent(initialState, initialSocketProtocolState, {
      response_id: null,
      state: {
        sheets: {},
        instanced_sheets: {},
        items: {
          item_1: {
            id: "item_1",
            name: "Focus Ring",
            description: "Improves health.",
            price: "120g",
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

    const created = applyAuthoritativeEvent(initial.state, initial.protocolState, {
      response_id: null,
      ops: [
        {
          op: "add",
          path: "/items/item_1/augmentation_templates/-",
          value: augmentationTemplate()
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-upsert-augmentation"
    });

    expect(created.state.serverState.items.item_1?.augmentation_templates).toHaveLength(1);
    expect(
      created.state.serverState.items.item_1?.augmentation_templates?.[0]?.effect
    ).toMatchObject({
      value: { text: "2" }
    });

    const edited = applyAuthoritativeEvent(created.state, created.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/items/item_1/augmentation_templates/0",
          value: augmentationTemplate({ value: "4" })
        }
      ],
      state_version: 2,
      type: "state_patch",
      request_id: "req-update-augmentation"
    });

    expect(
      edited.state.serverState.items.item_1?.augmentation_templates?.[0]?.effect
    ).toMatchObject({
      value: { text: "4" }
    });

    const deleted = applyAuthoritativeEvent(edited.state, edited.protocolState, {
      response_id: null,
      ops: [
        {
          op: "remove",
          path: "/items/item_1/augmentation_templates/0"
        }
      ],
      state_version: 3,
      type: "state_patch",
      request_id: "req-remove-augmentation"
    });

    expect(deleted.state.serverState.items.item_1?.augmentation_templates).toEqual([]);
  });

  it("reconciles action-history append and prune patches from authoritative backend state", () => {
    const initial = applyAuthoritativeEvent(initialState, initialSocketProtocolState, {
      response_id: null,
      state: {
        sheets: {},
        instanced_sheets: {},
        items: {},
        actions: {},
        formulas: {},
        proficiencies: {},
        action_history: {
          history_old: actionHistoryEntry({
            id: "history_old",
            summary: "Old action succeeded.",
            version: 1
          })
        }
      },
      state_version: 0,
      type: "state_snapshot",
      request_id: null
    });

    expect(initial.state.serverState.actionHistoryOrder).toEqual(["history_old"]);

    const appended = applyAuthoritativeEvent(initial.state, initial.protocolState, {
      response_id: null,
      ops: [
        {
          op: "add",
          path: "/action_history/history_new",
          value: actionHistoryEntry({
            id: "history_new",
            summary: "New action succeeded.",
            version: 2
          })
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-append-history"
    });

    expect(appended.state.serverState.actionHistoryOrder).toEqual(["history_old", "history_new"]);
    expect(appended.state.serverState.actionHistory.history_new?.summary).toBe(
      "New action succeeded."
    );

    const pruned = applyAuthoritativeEvent(appended.state, appended.protocolState, {
      response_id: null,
      ops: [
        {
          op: "remove",
          path: "/action_history/history_old"
        }
      ],
      state_version: 2,
      type: "state_patch",
      request_id: "req-prune-history"
    });

    expect(pruned.state.serverState.actionHistory.history_old).toBeUndefined();
    expect(pruned.state.serverState.actionHistoryOrder).toEqual(["history_new"]);
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

  it("reconciles template and instance notes patches while preserving player-redacted template notes", () => {
    const selectedState = reducer(initialState, {
      type: "set_active_sheet_local",
      sheetId: "instance_1"
    });
    const initial = applyAuthoritativeEvent(selectedState, initialSocketProtocolState, {
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
            notes: "Initial instance notes.",
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

    const redactedDetail = selectActiveSheetDetail(initial.state);
    expect(redactedDetail?.sheet?.notes).toBeUndefined();
    expect(redactedDetail?.instance.notes).toBe("Initial instance notes.");

    const withTemplateNotes = applyAuthoritativeEvent(initial.state, initial.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/sheets/sheet_1/notes",
          value: "GM-visible template notes."
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-template-notes"
    });

    expect(withTemplateNotes.state.serverState.sheets.sheet_1?.notes).toBe(
      "GM-visible template notes."
    );
    expect(selectActiveSheetDetail(withTemplateNotes.state)?.sheet?.notes).toBe(
      "GM-visible template notes."
    );

    const withInstanceNotes = applyAuthoritativeEvent(
      withTemplateNotes.state,
      withTemplateNotes.protocolState,
      {
        response_id: null,
        ops: [
          {
            op: "set",
            path: "/instanced_sheets/instance_1/notes",
            value: "Edited instance notes."
          }
        ],
        state_version: 2,
        type: "state_patch",
        request_id: "req-instance-notes"
      }
    );

    const detail = selectActiveSheetDetail(withInstanceNotes.state);
    expect(withInstanceNotes.state.serverState.persistentSheets.instance_1?.notes).toBe(
      "Edited instance notes."
    );
    expect(detail?.sheet?.notes).toBe("GM-visible template notes.");
    expect(detail?.instance.notes).toBe("Edited instance notes.");
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

  it("reconciles base stat patches from authoritative state", () => {
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

  it("reconciles formula-backed stat patches without evaluating formulas on the frontend", () => {
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

    expect(selectActiveSheetDetail(initial.state)?.stats.reaction_time).toBe(10);

    const result = applyAuthoritativeEvent(initial.state, initial.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/sheets/sheet_1/stats/reaction_time",
          value: {
            aliases: null,
            text: "37"
          }
        }
      ],
      state_version: 1,
      type: "state_patch",
      request_id: "req-formula-stat"
    });

    expect(result.state.serverState.sheets.sheet_1?.stats.reaction_time).toEqual({
      aliases: null,
      text: "37"
    });
    expect(selectActiveSheetDetail(result.state)?.stats.reaction_time).toBe(37);

    const formulaTextResult = applyAuthoritativeEvent(result.state, result.protocolState, {
      response_id: null,
      ops: [
        {
          op: "set",
          path: "/sheets/sheet_1/stats/reaction_time",
          value: {
            aliases: null,
            text: "10 + 5"
          }
        }
      ],
      state_version: 2,
      type: "state_patch",
      request_id: "req-formula-stat-text"
    });

    expect(formulaTextResult.state.serverState.sheets.sheet_1?.stats.reaction_time).toEqual({
      aliases: null,
      text: "10 + 5"
    });
    expect(selectActiveSheetDetail(formulaTextResult.state)?.stats.reaction_time).toBe(0);
  });
});
