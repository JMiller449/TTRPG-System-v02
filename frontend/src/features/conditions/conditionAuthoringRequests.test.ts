import { describe, expect, it } from "vitest";
import type { ConditionPreset } from "@/domain/models";
import { createEmptyAugmentationEditorValues } from "@/features/augmentations/augmentationEditorValues";
import { createEmptyConditionPresetEditorValues } from "@/features/conditions/conditionEditorValues";
import {
  buildCreateConditionPresetSubmission,
  buildDeleteConditionPresetSubmission,
  buildRemoveConditionAugmentationSubmission,
  buildUpdateConditionPresetSubmission,
  buildUpsertConditionAugmentationSubmission,
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
      label: "Delete condition: Poisoned"
    });
  });

  it("builds condition augmentation upsert and remove submissions through condition updates", () => {
    const values = createEmptyAugmentationEditorValues();
    values.name = "Poison Drain";
    values.operation = "subtract";
    values.targetPath = ["stats", "stamina"];
    values.formulaText = "2";

    const upsert = buildUpsertConditionAugmentationSubmission({
      condition: condition(),
      values,
      augmentationId: "poison-drain"
    });

    expect(upsert?.request).toMatchObject({
      type: "update_condition_preset",
      condition_id: "poisoned",
      condition_partial: {
        id: "poisoned",
        name: "Poisoned",
        augmentation_ids: ["poison-drain"],
        augmentation_templates: [
          {
            id: "poison-drain",
            source: {
              type: "condition",
              id: "poisoned",
              label: "Poisoned"
            },
            scope: "instance",
            target: {
              root: "instance",
              path: ["stats", "stamina"]
            }
          }
        ]
      }
    });

    const conditionWithAugmentation = upsert?.request.type === "update_condition_preset"
      ? (upsert.request.condition_partial as unknown as ConditionPreset)
      : condition();

    expect(
      buildRemoveConditionAugmentationSubmission({
        condition: conditionWithAugmentation,
        augmentationId: "poison-drain"
      })?.request
    ).toMatchObject({
      type: "update_condition_preset",
      condition_id: "poisoned",
      condition_partial: {
        augmentation_ids: [],
        augmentation_templates: []
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
