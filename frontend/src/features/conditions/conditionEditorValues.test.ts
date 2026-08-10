import { describe, expect, it } from "vitest";
import type { ConditionPreset } from "@/domain/models";
import {
  createEmptyConditionPresetEditorValues,
  hasValidConditionPresetValues,
  toConditionPresetEditorValues,
  toConditionPresetPayload,
  toUpdatedConditionPresetPayload
} from "@/features/conditions/conditionEditorValues";

const condition = (): ConditionPreset => ({
  id: "poisoned",
  name: "Poisoned",
  description: "Ongoing poison.",
  visibility: "public",
  effect_ids: ["poison_drain"]
});

describe("conditionEditorValues", () => {
  it("round-trips canonical effect references", () => {
    const values = toConditionPresetEditorValues(condition());
    expect(values.effectIds).toEqual(["poison_drain"]);
    expect(toConditionPresetPayload({ values, conditionId: "poisoned" })).toEqual({
      id: "poisoned",
      name: "Poisoned",
      description: "Ongoing poison.",
      visibility: "public",
      effect_ids: ["poison_drain"]
    });
  });

  it("builds empty drafts and trims authored text", () => {
    const values = createEmptyConditionPresetEditorValues();
    expect(values.effectIds).toEqual([]);
    expect(hasValidConditionPresetValues(values)).toBe(false);
    values.name = "  Burning  ";
    values.description = "  On fire.  ";
    values.effectIds = ["burning_damage"];
    expect(hasValidConditionPresetValues(values)).toBe(true);
    expect(toConditionPresetPayload({ values, conditionId: "burning" })).toMatchObject({
      name: "Burning",
      description: "On fire.",
      effect_ids: ["burning_damage"]
    });
  });

  it("requires an existing condition for updates", () => {
    const values = toConditionPresetEditorValues(condition());
    expect(toUpdatedConditionPresetPayload(undefined, values)).toBeNull();
    expect(toUpdatedConditionPresetPayload(condition(), values)?.id).toBe("poisoned");
  });
});
