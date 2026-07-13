import { describe, expect, it } from "vitest";
import type { ActionDefinition, Sheet } from "@/domain/models";
import {
  buildQuickRollExecutionRequest,
  getQuickRollRelationshipId,
  resolveQuickRollAction
} from "@/features/rolls/quickRolls";
import { actionRollModes } from "@/features/rolls/actionRollModes";
import { FORMULA_STAT_KEYS } from "@/features/sheets/sheetDefinitionEditing";
import { createDefaultStats } from "@/features/sheets/templateEditorValues";

const formulaDefaults = FORMULA_STAT_KEYS.map((statName) => ({
  stat_name: statName,
  formula: {
    aliases: [{ name: "strength", path: ["stats", "strength"] }],
    text: "@strength",
    tags: []
  }
}));

function testSheet(overrides: Partial<Sheet> = {}): Sheet {
  return {
    id: "sheet_1",
    name: "Fighter",
    dm_only: false,
    xp_given_when_slayed: 0,
    xp_cap: 0,
    proficiencies: {},
    items: {},
    stats: createDefaultStats(formulaDefaults),
    actions: {
      default_dodge: {
        relationship_id: "default_dodge",
        entry_id: "custom_dodge"
      }
    },
    ...overrides
  };
}

const actions: Record<string, ActionDefinition> = {
  weapon_attack: {
    id: "weapon_attack",
    name: "Weapon Attack"
  },
  custom_dodge: {
    id: "custom_dodge",
    name: "Sidestep"
  }
};

describe("quickRolls", () => {
  it("exposes only modes supported by each authored action kind", () => {
    expect(actionRollModes("none")).toEqual(["normal"]);
    expect(actionRollModes("check")).toEqual(["normal", "advantage", "disadvantage"]);
    expect(actionRollModes("damage")).toEqual(["normal", "critical"]);
  });

  it("returns stable default action relationship ids", () => {
    expect(getQuickRollRelationshipId("weapon_attack")).toBe("default_weapon_attack");
    expect(getQuickRollRelationshipId("block")).toBe("default_block");
  });

  it("resolves quick controls through authoritative sheet action bridges", () => {
    expect(resolveQuickRollAction(testSheet(), actions, "dodge")).toEqual({
      action: "dodge",
      actionId: "custom_dodge",
      actionName: "Sidestep",
      relationshipId: "default_dodge"
    });
  });

  it("builds typed perform_action requests for resolved quick actions", () => {
    const resolution = resolveQuickRollAction(testSheet(), actions, "dodge");

    if (!resolution) {
      throw new Error("Expected attack quick action to resolve.");
    }

    expect(
      buildQuickRollExecutionRequest({
        sheetId: "instance_1",
        resolution,
        rollMode: "advantage"
      })
    ).toEqual({
      request: {
        type: "perform_action",
        sheet_id: "instance_1",
        action_id: "custom_dodge",
        roll_mode: "advantage"
      },
      label: "Perform action: Sidestep (advantage)"
    });
  });

  it("respects edited default bridges that point at replacement actions", () => {
    expect(resolveQuickRollAction(testSheet(), actions, "dodge")).toEqual({
      action: "dodge",
      actionId: "custom_dodge",
      actionName: "Sidestep",
      relationshipId: "default_dodge"
    });
  });

  it("resolves an eligible canonical quick action from an item grant", () => {
    const sheet = testSheet();
    sheet.actions = {};
    sheet.items = {
      potion_2: {
        relationship_id: "potion_2",
        item_id: "potion",
        count: 2,
        equipped: false
      }
    };

    expect(
      resolveQuickRollAction(sheet, actions, "weapon_attack", {
        potion: {
          id: "potion",
          name: "Attack Sword",
          interaction_type: "consumable",
          description: "",
          price: "",
          weight: 0,
          action_grants: [
            {
              action_id: "weapon_attack",
              availability: "carried",
              consume_quantity: 1
            }
          ]
        }
      })
    ).toEqual({
      action: "weapon_attack",
      actionId: "weapon_attack",
      actionName: "Weapon Attack",
      relationshipId: "item:potion_2:weapon_attack",
      sourceItemRelationshipId: "potion_2"
    });
  });

  it("prefers item sources and ignores direct sheet bridges for weapon quick actions", () => {
    const sheet = testSheet({
      actions: {
        stale_weapon_attack: {
          relationship_id: "stale_weapon_attack",
          entry_id: "weapon_attack"
        }
      },
      items: {
        sword_bridge: {
          relationship_id: "sword_bridge",
          item_id: "sword",
          count: 1,
          equipped: true
        }
      }
    });

    expect(
      resolveQuickRollAction(sheet, actions, "weapon_attack", {
        sword: {
          id: "sword",
          name: "Sword",
          interaction_type: "equippable",
          description: "",
          price: "",
          weight: 0,
          action_grants: [
            {
              action_id: "weapon_attack",
              availability: "equipped",
              consume_quantity: 0
            }
          ]
        }
      })
    ).toEqual({
      action: "weapon_attack",
      actionId: "weapon_attack",
      actionName: "Weapon Attack",
      relationshipId: "item:sword_bridge:weapon_attack",
      sourceItemRelationshipId: "sword_bridge"
    });

    sheet.items = {};
    expect(resolveQuickRollAction(sheet, actions, "weapon_attack")).toBeNull();
  });

  it("does not resolve removed or missing quick actions", () => {
    expect(resolveQuickRollAction(testSheet(), actions, "block")).toBeNull();
    expect(resolveQuickRollAction(testSheet(), {}, "weapon_attack")).toBeNull();
    expect(resolveQuickRollAction(null, actions, "weapon_attack")).toBeNull();
  });
});
