import { describe, expect, it } from "vitest";
import { buildResourceModifierSubmission } from "@/features/sheets/resourceEditorRequests";

describe("resourceEditorRequests", () => {
  it("routes negative health modifiers through typed backend damage", () => {
    expect(
      buildResourceModifierSubmission({
        instanceId: "instance_1",
        resource: "health",
        delta: -12,
        damageType: "Fire"
      })
    ).toEqual({
      request: {
        type: "apply_instanced_sheet_damage",
        instance_id: "instance_1",
        amount: 12,
        damage_type: "Fire"
      },
      label: "Apply Fire damage"
    });
  });

  it("requires a damage type for negative health modifiers", () => {
    expect(
      buildResourceModifierSubmission({
        instanceId: "instance_1",
        resource: "health",
        delta: -12,
        damageType: ""
      })
    ).toEqual({ error: "Select a damage type before applying damage." });
  });

  it("keeps healing and mana changes on direct resource adjustment", () => {
    expect(
      buildResourceModifierSubmission({
        instanceId: "instance_1",
        resource: "health",
        delta: 5,
        damageType: "Fire"
      })
    ).toMatchObject({
      request: {
        type: "adjust_instanced_sheet_resource",
        resource: "health",
        delta: 5
      }
    });
    expect(
      buildResourceModifierSubmission({
        instanceId: "instance_1",
        resource: "mana",
        delta: -3,
        damageType: ""
      })
    ).toMatchObject({
      request: {
        type: "adjust_instanced_sheet_resource",
        resource: "mana",
        delta: -3
      }
    });
  });
});
