import { describe, expect, it } from "vitest";
import type { ConditionPreset } from "@/domain/models";
import { createEmptyConditionPresetEditorValues } from "@/features/conditions/conditionEditorValues";
import {
  buildCreateConditionPresetSubmission,
  buildDeleteConditionPresetSubmission,
  buildLoadConditionAugmentationTargetMetadataSubmission,
  buildUpdateConditionPresetSubmission,
  selectOrderedConditionPresets
} from "@/features/conditions/conditionAuthoringRequests";

function condition(): ConditionPreset {
  return {
    id: "poisoned",
    name: "Poisoned",
    description: "",
    visibility: "public",
    effect_ids: []
  };
}

describe("conditionAuthoringRequests", () => {
  it("builds condition create submissions", () => {
    const values = createEmptyConditionPresetEditorValues();
    values.name = "  Poisoned  ";
    values.description = "  Poison status.  ";
    values.visibility = "gm_only";

    expect(buildCreateConditionPresetSubmission(values, "condition_created")).toEqual({
      request: {
        type: "create_condition_preset",
        condition: {
          id: "condition_created",
          name: "Poisoned",
          description: "Poison status.",
          visibility: "gm_only",
          effect_ids: []
        }
      },
      label: "Create condition: Poisoned"
    });
  });

  it("does not build condition create or update submissions without a name", () => {
    const values = createEmptyConditionPresetEditorValues();

    expect(buildCreateConditionPresetSubmission(values, "condition_created")).toBeNull();
    expect(buildUpdateConditionPresetSubmission(condition(), values)).toBeNull();
  });

  it("builds condition update and delete submissions", () => {
    const values = createEmptyConditionPresetEditorValues();
    values.name = "Venomed";

    expect(buildUpdateConditionPresetSubmission(condition(), values)).toEqual({
      request: {
        type: "update_condition_preset",
        condition_id: "poisoned",
        condition_partial: {
          id: "poisoned",
          name: "Venomed",
          description: "",
          visibility: "public",
          effect_ids: []
        }
      },
      label: "Update condition: Venomed"
    });

    expect(buildDeleteConditionPresetSubmission("poisoned", condition())).toEqual({
      request: {
        type: "delete_condition_preset",
        condition_id: "poisoned"
      },
      label: "Delete condition: Poisoned",
      confirmation: 'Delete condition "Poisoned"?'
    });
  });

  it("builds condition augmentation target metadata load submissions", () => {
    expect(buildLoadConditionAugmentationTargetMetadataSubmission()).toEqual({
      request: {
        type: "get_augmentation_target_metadata",
        context: "condition_template"
      },
      label: "Load condition augmentation targets"
    });
  });

  it("includes canonical effect references in the initial condition create submission", () => {
    const values = createEmptyConditionPresetEditorValues();
    values.name = "Poisoned";
    values.effectIds = ["poison-drain"];

    expect(buildCreateConditionPresetSubmission(values, "poisoned")?.request).toMatchObject({
      type: "create_condition_preset",
      condition: {
        id: "poisoned",
        effect_ids: ["poison-drain"]
      }
    });
  });

  it("orders condition presets from authoritative state order", () => {
    expect(
      selectOrderedConditionPresets(
        {
          poisoned: condition(),
          burning: { ...condition(), id: "burning", name: "Burning" }
        },
        ["burning", "poisoned", "missing"]
      ).map((entry) => entry.name)
    ).toEqual(["Burning", "Poisoned"]);
  });
});
