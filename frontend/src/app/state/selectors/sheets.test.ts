import { describe, expect, it } from "vitest";
import { initialState } from "@/app/state/initialState";
import type { AppState } from "@/app/state/types";
import type { Formula, ItemBridge, ItemDefinition, PersistentSheet, Sheet, Stats } from "@/domain/models";
import {
  selectSheetAssignedActions,
  selectActiveSheetDetail,
  selectActiveWeaponEntryId,
  selectActiveWeaponLabel,
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
    description: "",
    price: "",
    weight: "",
    augmentation_templates: []
  };
}

function equipmentBridge(
  relationshipId: string,
  itemId: string,
  active: boolean
): ItemBridge {
  return {
    relationship_id: relationshipId,
    item_id: itemId,
    count: 1,
    active
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
    xp_cap: "",
    proficiencies: {},
    items,
    stats: stats(),
    slayed_record: {},
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
        sheet_player: sheet("sheet_player", "Mage", {
          [staff.relationship_id]: staff,
          [lantern.relationship_id]: lantern
        }, {
          actions: {
            action_bridge_attack: {
              relationship_id: "action_bridge_attack",
              entry_id: "action_attack"
            },
            action_bridge_missing: {
              relationship_id: "action_bridge_missing",
              entry_id: "missing_action"
            }
          }
        }),
        sheet_enemy: sheet("sheet_enemy", "Ash Warden", {}, { dm_only: true })
      },
      sheetOrder: ["sheet_player", "sheet_enemy"],
      persistentSheets: {
        instance_player: persistentSheet(),
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
        }
      },
      actionOrder: ["action_attack"],
      sheetPresentation: {
        sheet_player: {
          kind: "player",
          notes: "Presentation notes",
          tags: ["caster", "starter"],
          updatedAt: "2026-06-18T01:00:00Z"
        }
      },
      persistentSheetPresentation: {
        instance_player: {
          name: "Ari",
          updatedAt: "2026-06-18T02:00:00Z"
        }
      }
    },
    uiState: {
      ...initialState.uiState,
      activeSheetId: "instance_player"
    }
  };
}

describe("sheet selectors", () => {
  it("projects template views from authoritative sheet state and presentation metadata", () => {
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
      notes: "Mage template notes",
      tags: ["caster", "starter"],
      updatedAt: "2026-06-18T01:00:00Z"
    });
    expect(playerTemplate?.stats.health).toBe(45);
    expect(playerTemplate?.stats.acrobatics).toBe(0);

    expect(selectSheetTemplateView(state, "sheet_enemy")?.kind).toBe("enemy");
    expect(selectSheetTemplateView(state, "missing")).toBeNull();
  });

  it("projects active instance detail with current resources from the instance", () => {
    const state = stateFixture();

    const detail = selectActiveSheetDetail(state);
    expect(detail?.instance).toMatchObject({
      id: "instance_player",
      kind: "player",
      name: "Ari",
      notes: "Instance notes",
      updatedAt: "2026-06-18T02:00:00Z"
    });
    expect(detail?.sheet?.id).toBe("sheet_player");
    expect(detail?.stats.health).toBe(37);
    expect(detail?.stats.mana).toBe(9);
    expect(detail?.stats.strength).toBe(12);
    expect(detail?.stats.acrobatics).toBe(0);
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

  it("resolves template equipment and active weapon labels from sheet or instance ids", () => {
    const state = stateFixture();

    expect(selectSheetEquipment(state, "sheet_player")).toEqual([
      {
        relationship_id: "bridge_staff",
        item_id: "item_staff",
        count: 1,
        active: true
      },
      {
        relationship_id: "bridge_lantern",
        item_id: "item_lantern",
        count: 1,
        active: false
      }
    ]);
    expect(selectSheetEquipment(state, "instance_player")).toEqual(
      selectSheetEquipment(state, "sheet_player")
    );
    expect(selectActiveWeaponEntryId(state, "instance_player")).toBe("bridge_staff");
    expect(selectActiveWeaponLabel(state, "instance_player")).toBe("Arc Staff");
    expect(selectActiveWeaponLabel(state, "missing")).toBe("None");
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
    expect(selectSheetAssignedActions(state, "instance_player").map((entry) => entry.action.name)).toEqual([
      "Arc Strike"
    ]);
    expect(selectSheetAssignedActions(state, "missing")).toEqual([]);
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
