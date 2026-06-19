import { describe, expect, it } from "vitest";
import type { ActionDefinition, Sheet } from "@/domain/models";
import {
  getQuickRollRelationshipId,
  QUICK_ROLL_DEFAULT_STATS,
  resolveQuickRollAction
} from "@/features/rolls/quickRolls";
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
  it("returns stable default action relationship ids", () => {
    expect(getQuickRollRelationshipId("attack")).toBe("default_attack");
    expect(getQuickRollRelationshipId("block")).toBe("default_block");
  });

  it("defines the default stat used when quick controls prefill the composer", () => {
    expect(QUICK_ROLL_DEFAULT_STATS).toEqual({
      attack: "strength",
      dodge: "dexterity",
      parry: "dexterity",
      block: "constitution"
    });
  });

  it("resolves quick controls through authoritative sheet action bridges", () => {
    expect(resolveQuickRollAction(testSheet(), actions, "attack")).toEqual({
      action: "attack",
      actionId: "attack",
      actionName: "Attack",
      relationshipId: "default_attack"
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

  it("does not resolve removed or missing quick actions", () => {
    expect(resolveQuickRollAction(testSheet(), actions, "block")).toBeNull();
    expect(resolveQuickRollAction(testSheet(), {}, "attack")).toBeNull();
    expect(resolveQuickRollAction(null, actions, "attack")).toBeNull();
  });
});
