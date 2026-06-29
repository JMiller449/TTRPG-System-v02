import { describe, expect, it } from "vitest";
import type { ActionDefinition, Sheet } from "@/domain/models";
import {
  buildQuickRollExecutionRequest,
  getQuickRollRelationshipId,
  resolveQuickRollAction
} from "@/features/rolls/quickRolls";
import { actionRollModes } from "@/features/rolls/actionRollModes";
import { createDefaultStats } from "@/features/sheets/templateEditorValues";

function testSheet(overrides: Partial<Sheet> = {}): Sheet {
  return {
    id: "sheet_1",
    name: "Fighter",
    dm_only: false,
    xp_given_when_slayed: 0,
    xp_cap: "",
    proficiencies: {},
    items: {},
    stats: createDefaultStats(),
    slayed_record: {},
    actions: {
      default_attack: {
        relationship_id: "default_attack",
        entry_id: "attack"
      },
      default_dodge: {
        relationship_id: "default_dodge",
        entry_id: "custom_dodge"
      }
    },
    ...overrides
  };
}

const actions: Record<string, ActionDefinition> = {
  attack: {
    id: "attack",
    name: "Attack"
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
    expect(getQuickRollRelationshipId("attack")).toBe("default_attack");
    expect(getQuickRollRelationshipId("block")).toBe("default_block");
  });

  it("resolves quick controls through authoritative sheet action bridges", () => {
    expect(resolveQuickRollAction(testSheet(), actions, "attack")).toEqual({
      action: "attack",
      actionId: "attack",
      actionName: "Attack",
      relationshipId: "default_attack"
    });
  });

  it("builds typed perform_action requests for resolved quick actions", () => {
    const resolution = resolveQuickRollAction(testSheet(), actions, "attack");

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
        action_id: "attack",
        roll_mode: "advantage"
      },
      label: "Perform action: Attack (advantage)"
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
      resolveQuickRollAction(sheet, actions, "attack", {
        potion: {
          id: "potion",
          name: "Attack Potion",
          interaction_type: "consumable",
          description: "",
          price: "",
          weight: "",
          action_grants: [
            { action_id: "attack", availability: "carried", consume_quantity: 1 }
          ]
        }
      })
    ).toEqual({
      action: "attack",
      actionId: "attack",
      actionName: "Attack",
      relationshipId: "item:potion_2:attack",
      sourceItemRelationshipId: "potion_2"
    });
  });

  it("does not resolve removed or missing quick actions", () => {
    expect(resolveQuickRollAction(testSheet(), actions, "block")).toBeNull();
    expect(resolveQuickRollAction(testSheet(), {}, "attack")).toBeNull();
    expect(resolveQuickRollAction(null, actions, "attack")).toBeNull();
  });
});
