import { describe, expect, it } from "vitest";
import { initialState } from "@/app/state/initialState";
import type { AppState } from "@/app/state/types";
import type {
  Formula,
  ItemBridge,
  ItemDefinition,
  PersistentSheet,
  Sheet,
  Stats
} from "@/domain/models";
import {
  selectActiveConditions,
  selectActiveStandaloneEffects,
  selectSheetAssignedActions,
  selectActiveSheetDetail,
  selectAvailableItems,
  selectPlayerInstances,
  selectSheetEquipment,
  selectSheetInstanceView,
  selectSheetTemplateView,
  selectSheetTemplateViews
} from "@/app/state/selectors";

function formula(text: string): Formula {
  return { aliases: null, text };
}

function stats(overrides: Partial<Stats> = {}): Stats {
  return {
    strength: 12,
    dexterity: 10,
    constitution: 9,
    perception: 8,
    arcane: 7,
    will: 6,
    lifting: formula("14"),
    carry_weight: formula("20"),
    acrobatics: formula("not resolved on the frontend"),
    stamina: formula("11"),
    reaction_time: formula("10"),
    health: formula("45"),
    endurance: formula("9"),
    pain_tolerance: formula("8"),
    sight_distance: formula("7"),
    intuition: formula("6"),
    registration: formula("5"),
    mana: formula("30"),
    control: formula("4"),
    sensitivity: formula("3"),
    charisma: formula("2"),
    mental_fortitude: formula("1"),
    courage: formula("13"),
    ...overrides
  };
}

function item(id: string, name: string): ItemDefinition {
  return {
    id,
    name,
    interaction_type: "equippable",
    description: "",
    price: "",
    weight: 0,
    augmentation_templates: []
  };
}

function equipmentBridge(relationshipId: string, itemId: string, equipped: boolean): ItemBridge {
  return {
    relationship_id: relationshipId,
    item_id: itemId,
    count: 1,
    equipped
  };
}

function sheet(
  id: string,
  name: string,
  items: Record<string, ItemBridge> = {},
  overrides: Partial<Sheet> = {}
): Sheet {
  return {
    id,
    name,
    notes: `${name} template notes`,
    dm_only: false,
    xp_given_when_slayed: 0,
    xp_cap: 0,
    proficiencies: {},
    items,
    stats: stats(),
    evaluated_stats: {
      lifting: 14,
      carry_weight: 20,
      acrobatics: 9,
      stamina: 11,
      reaction_time: 10,
      health: 45,
      endurance: 9,
      pain_tolerance: 8,
      sight_distance: 7,
      intuition: 6,
      registration: 5,
      mana: 30,
      control: 4,
      sensitivity: 3,
      charisma: 2,
      mental_fortitude: 1,
      courage: 13
    },
    evaluated_max_health: 450,
    evaluated_max_mana: 210,
    actions: {},
    ...overrides
  };
}

function persistentSheet(overrides: Partial<PersistentSheet> = {}): PersistentSheet {
  return {
    parent_id: "sheet_player",
    notes: "Instance notes",
    health: 37,
    mana: 9,
    augments: {},
    ...overrides
  };
}

function stateFixture(): AppState {
  const staff = equipmentBridge("bridge_staff", "item_staff", true);
  const lantern = equipmentBridge("bridge_lantern", "item_lantern", false);

  return {
    ...initialState,
    serverState: {
      ...initialState.serverState,
      sheets: {
        sheet_player: sheet(
          "sheet_player",
          "Mage",
          {
            [staff.relationship_id]: staff,
            [lantern.relationship_id]: lantern
          },
          {
            actions: {
              action_bridge_attack: {
                relationship_id: "action_bridge_attack",
                entry_id: "action_attack"
              },
              action_bridge_missing: {
                relationship_id: "action_bridge_missing",
                entry_id: "missing_action"
              },
              stale_weapon_damage: {
                relationship_id: "stale_weapon_damage",
                entry_id: "weapon_damage"
              }
            }
          }
        ),
        sheet_enemy: sheet("sheet_enemy", "Ash Warden", {}, { dm_only: true })
      },
      sheetOrder: ["sheet_player", "sheet_enemy"],
      persistentSheets: {
        instance_player: persistentSheet({
          items: {
            [staff.relationship_id]: staff,
            [lantern.relationship_id]: lantern
          }
        }),
        instance_orphan: persistentSheet({
          parent_id: "missing_parent",
          notes: undefined,
          health: 1,
          mana: 2
        })
      },
      persistentSheetOrder: ["instance_player", "instance_orphan"],
      items: {
        item_staff: item("item_staff", "Arc Staff"),
        item_lantern: item("item_lantern", "Storm Lantern")
      },
      itemOrder: ["item_lantern", "item_staff"],
      actions: {
        action_attack: {
          id: "action_attack",
          name: "Arc Strike",
          notes: "A focused attack.",
          steps: []
        },
        weapon_damage: {
          id: "weapon_damage",
          name: "Weapon Damage",
          notes: "Requires a source item.",
          steps: []
        }
      },
      actionOrder: ["action_attack"]
    },
    uiState: {
      ...initialState.uiState,
      activeSheetId: "instance_player"
    }
  };
}

describe("sheet selectors", () => {
  it("projects template views from authoritative sheet state", () => {
    const state = stateFixture();

    expect(selectSheetTemplateViews(state).map((entry) => entry.id)).toEqual([
      "sheet_player",
      "sheet_enemy"
    ]);

    const playerTemplate = selectSheetTemplateView(state, "sheet_player");
    expect(playerTemplate).toMatchObject({
      id: "sheet_player",
      kind: "player",
      name: "Mage",
      notes: "Mage template notes"
    });
    expect(playerTemplate?.stats.health).toBe(45);
    expect(playerTemplate?.stats.acrobatics).toBe(9);

    expect(selectSheetTemplateView(state, "sheet_enemy")?.kind).toBe("enemy");
    expect(selectSheetTemplateView(state, "missing")).toBeNull();
  });

  it("projects active instance detail with current resources from the instance", () => {
    const state = stateFixture();

    const detail = selectActiveSheetDetail(state);
    expect(detail?.instance).toMatchObject({
      id: "instance_player",
      kind: "player",
      name: "Mage",
      notes: "Instance notes"
    });
    expect(detail?.sheet?.id).toBe("sheet_player");
    expect(detail?.stats.health).toBe(45);
    expect(detail?.stats.mana).toBe(30);
    expect(detail?.resources).toEqual({ health: 37, mana: 9 });
    expect(detail?.resourceMaximums).toEqual({ health: 450, mana: 210 });
    expect(detail?.stats.strength).toBe(12);
    expect(detail?.stats.acrobatics).toBe(9);
  });

  it("keeps orphan instances selectable without inventing parent sheet data", () => {
    const state = {
      ...stateFixture(),
      uiState: {
        ...stateFixture().uiState,
        activeSheetId: "instance_orphan"
      }
    };

    const instance = selectSheetInstanceView(state, "instance_orphan");
    expect(instance).toMatchObject({
      id: "instance_orphan",
      parentSheet: null,
      kind: "player",
      name: "instance_orphan",
      notes: ""
    });
    expect(selectActiveSheetDetail(state)?.stats).toEqual({});
  });

  it("resolves template defaults separately from instance inventory", () => {
    const state = stateFixture();

    expect(selectSheetEquipment(state, "sheet_player")).toEqual([
      {
        relationship_id: "bridge_staff",
        item_id: "item_staff",
        count: 1,
        equipped: true
      },
      {
        relationship_id: "bridge_lantern",
        item_id: "item_lantern",
        count: 1,
        equipped: false
      }
    ]);
    expect(selectSheetEquipment(state, "instance_player")).toEqual(
      selectSheetEquipment(state, "sheet_player")
    );
  });

  it("selects active condition applications for one instance", () => {
    const state = stateFixture();
    state.serverState.activeConditions = {
      "condition:poisoned:instance_player": {
        application_id: "condition:poisoned:instance_player",
        condition_id: "poisoned",
        condition_name: "Poisoned",
        description: "Ongoing poison.",
        visibility: "public",
        instance_id: "instance_player",
        augmentation_ids: ["poison-drain"]
      },
      "condition:hidden:instance_orphan": {
        application_id: "condition:hidden:instance_orphan",
        condition_id: "hidden",
        condition_name: "Hidden",
        description: "",
        visibility: "gm_only",
        instance_id: "instance_orphan",
        augmentation_ids: []
      }
    };
    state.serverState.activeConditionOrder = [
      "condition:hidden:instance_orphan",
      "condition:poisoned:instance_player"
    ];

    expect(selectActiveConditions(state, "instance_player")).toEqual([
      state.serverState.activeConditions["condition:poisoned:instance_player"]
    ]);
  });

  it("joins active standalone applications to their definition and action step", () => {
    const state = stateFixture();
    state.serverState.actions.action_attack.steps = [
      {
        step_id: "effect_step",
        augmentation_id: "effect_blessing",
        operation: "apply",
        type: "apply_augmentation"
      }
    ];
    state.serverState.standaloneEffects.effect_blessing = {
      id: "effect_blessing",
      name: "Blessing",
      scope: "instance",
      target: { root: "instance", path: ["health"] },
      effect: {
        type: "formula_modifier",
        operation: "add",
        value: { aliases: null, text: "5" }
      }
    };
    state.serverState.standaloneEffectApplications = {
      "standalone:instance_player:effect_blessing": {
        application_id: "standalone:instance_player:effect_blessing",
        definition_id: "effect_blessing",
        instance_id: "instance_player",
        source: {
          type: "action",
          id: "action_attack",
          relationship_id: "effect_step"
        },
        active: true
      },
      "standalone:instance_orphan:effect_blessing": {
        application_id: "standalone:instance_orphan:effect_blessing",
        definition_id: "effect_blessing",
        instance_id: "instance_orphan",
        source: { type: "action", id: "action_attack", relationship_id: "effect_step" },
        active: true
      }
    };
    state.serverState.standaloneEffectApplicationOrder = [
      "standalone:instance_orphan:effect_blessing",
      "standalone:instance_player:effect_blessing"
    ];

    const [effect] = selectActiveStandaloneEffects(state, "instance_player");

    expect(effect.definition.name).toBe("Blessing");
    expect(effect.sourceAction?.name).toBe("Arc Strike");
    expect(effect.sourceStep?.step_id).toBe("effect_step");
  });

  it("resolves assigned actions from sheet or instance ids and filters stale bridges", () => {
    const state = stateFixture();

    expect(selectSheetAssignedActions(state, "sheet_player")).toEqual([
      {
        relationshipId: "action_bridge_attack",
        actionId: "action_attack",
        action: {
          id: "action_attack",
          name: "Arc Strike",
          notes: "A focused attack.",
          steps: []
        },
        bridge: {
          relationship_id: "action_bridge_attack",
          entry_id: "action_attack"
        }
      }
    ]);
    expect(
      selectSheetAssignedActions(state, "instance_player").map((entry) => entry.action.name)
    ).toEqual(["Arc Strike"]);
    expect(selectSheetAssignedActions(state, "missing")).toEqual([]);
  });

  it("resolves only eligible item-granted actions and preserves their source", () => {
    const state = stateFixture();
    state.serverState.actions.drink_potion = {
      id: "drink_potion",
      name: "Drink Potion",
      steps: []
    };
    state.serverState.actions.lantern_burst = {
      id: "lantern_burst",
      name: "Lantern Burst",
      steps: []
    };
    state.serverState.items.item_staff.action_grants = [
      { action_id: "drink_potion", availability: "carried", consume_quantity: 1 }
    ];
    state.serverState.items.item_lantern.action_grants = [
      { action_id: "lantern_burst", availability: "equipped", consume_quantity: 0 }
    ];

    expect(selectSheetAssignedActions(state, "instance_player").slice(1)).toEqual([
      {
        relationshipId: "item:bridge_staff:drink_potion",
        actionId: "drink_potion",
        action: state.serverState.actions.drink_potion,
        sourceItemRelationshipId: "bridge_staff",
        sourceItemName: "Arc Staff",
        sourceItemAvailability: "carried",
        consumeQuantity: 1
      }
    ]);

    const instanceItems = state.serverState.persistentSheets.instance_player.items;
    if (!instanceItems) {
      throw new Error("Expected instance inventory fixture.");
    }
    instanceItems.bridge_staff.count = 0;
    expect(
      selectSheetAssignedActions(state, "instance_player").map((entry) => entry.actionId)
    ).toEqual(["action_attack"]);
  });

  it("lists available items and filters player instances for player-only sheet selection", () => {
    const state = stateFixture();

    expect(selectAvailableItems(state).map((entry) => entry.name)).toEqual([
      "Storm Lantern",
      "Arc Staff"
    ]);
    expect(selectPlayerInstances(state).map((entry) => entry.id)).toEqual([
      "instance_player",
      "instance_orphan"
    ]);
  });
});
