import { describe, expect, it } from "vitest";
import type { ConditionPreset } from "@/domain/models";
import { createEmptyAugmentationEditorValues } from "@/features/augmentations/augmentationEditorValues";
import {
  createEmptyConditionPresetEditorValues,
  toConditionAugmentationTemplatePayload
} from "@/features/conditions/conditionEditorValues";
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
    augmentation_ids: [],
    augmentation_templates: []
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
          augmentation_ids: [],
          augmentation_templates: []
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
          augmentation_ids: [],
          augmentation_templates: []
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

  it("includes draft effects in the initial condition create submission", () => {
    const effectValues = createEmptyAugmentationEditorValues();
    effectValues.name = "Poison Drain";
    effectValues.operation = "subtract";
    effectValues.targetPath = ["stats", "stamina"];
    effectValues.formulaText = "2";
    const effect = toConditionAugmentationTemplatePayload({
      values: effectValues,
      augmentationId: "poison-drain",
      conditionId: "draft-condition",
      conditionName: "Poisoned"
    });
    if (!effect) {
      throw new Error("Expected a valid condition effect.");
    }
    const values = createEmptyConditionPresetEditorValues();
    values.name = "Poisoned";
    values.augmentationTemplates = [effect];

    expect(buildCreateConditionPresetSubmission(values, "poisoned")?.request).toMatchObject({
      type: "create_condition_preset",
      condition: {
        id: "poisoned",
        augmentation_ids: ["poison-drain"],
        augmentation_templates: [
          {
            id: "poison-drain",
            source: {
              type: "condition",
              id: "poisoned",
              label: "Poisoned"
            },
            target: {
              root: "instance",
              path: ["stats", "stamina"]
            }
          }
        ]
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
