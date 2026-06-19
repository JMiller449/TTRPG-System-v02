import { describe, expect, it } from "vitest";
import type { ConditionPreset } from "@/domain/models";
import {
  createEmptyConditionPresetEditorValues,
  removeConditionAugmentationTemplate,
  toConditionAugmentationTemplatePayload,
  toConditionPresetEditorValues,
  toConditionPresetPayload,
  toUpdatedConditionPresetPayload,
  upsertConditionAugmentationTemplate
} from "@/features/conditions/conditionEditorValues";
import { createEmptyAugmentationEditorValues } from "@/features/augmentations/augmentationEditorValues";

function condition(): ConditionPreset {
  return {
    id: "poisoned",
    name: "Poisoned",
    description: "Takes poison penalties.",
    visibility: "gm_only",
    augmentation_ids: ["poison-drain"],
    augmentation_templates: [
      {
        id: "poison-drain",
        name: "Poison Drain",
        description: "Reduces stamina.",
        source: {
          type: "condition",
          id: "poisoned",
          label: "Poisoned"
        },
        scope: "instance",
        target: {
          root: "instance",
          path: ["stats", "stamina"]
        },
        effect: {
          operation: "subtract",
          value: {
            aliases: null,
            text: "2"
          },
          type: "formula_modifier"
        },
        active: true,
        applied: false,
        applied_target_id: null
      }
    ]
  };
}

describe("conditionEditorValues", () => {
  it("maps condition records into editor values", () => {
    expect(toConditionPresetEditorValues(condition())).toEqual({
      name: "Poisoned",
      description: "Takes poison penalties.",
      visibility: "gm_only"
    });
  });

  it("builds condition preset payloads with augmentation ids derived from templates", () => {
    const values = createEmptyConditionPresetEditorValues();
    values.name = "  Burning  ";
    values.description = "  On fire.  ";

    expect(toConditionPresetPayload({ values, conditionId: "burning" })).toEqual({
      id: "burning",
      name: "Burning",
      description: "On fire.",
      visibility: "public",
      augmentation_ids: [],
      augmentation_templates: []
    });
  });

  it("preserves augmentation templates while updating condition metadata", () => {
    const values = createEmptyConditionPresetEditorValues();
    values.name = "  Venomed  ";
    values.description = "  Updated description.  ";
    values.visibility = "public";

    expect(toUpdatedConditionPresetPayload(condition(), values)).toEqual({
      id: "poisoned",
      name: "Venomed",
      description: "Updated description.",
      visibility: "public",
      augmentation_ids: ["poison-drain"],
      augmentation_templates: condition().augmentation_templates
    });
  });

  it("builds condition augmentation templates as current-instance effects", () => {
    const values = createEmptyAugmentationEditorValues();
    values.name = "  Poison Drain  ";
    values.description = "  Weakens the target.  ";
    values.operation = "subtract";
    values.targetPath = [" stats ", " stamina "];
    values.formulaText = "  2  ";
    values.duration = "encounter";
    values.removalCondition = "cured";

    expect(
      toConditionAugmentationTemplatePayload({
        values,
        augmentationId: "poison-drain",
        conditionId: "poisoned",
        conditionName: "Poisoned"
      })
    ).toEqual({
      id: "poison-drain",
      name: "Poison Drain",
      description: "Weakens the target.",
      source: {
        type: "condition",
        id: "poisoned",
        label: "Poisoned"
      },
      scope: "instance",
      target: {
        root: "instance",
        path: ["stats", "stamina"]
      },
      effect: {
        operation: "subtract",
        value: {
          aliases: null,
          text: "2"
        },
        type: "formula_modifier"
      },
      active: true,
      applied: false,
      applied_target_id: null,
      lifecycle: {
        duration: "encounter",
        expires_at: null,
        removal_condition: "cured"
      }
    });
  });

  it("upserts and removes condition augmentation templates", () => {
    const values = createEmptyAugmentationEditorValues();
    values.name = "Poison Pain";
    values.operation = "subtract";
    values.targetPath = ["stats", "pain_tolerance"];
    values.formulaText = "1";
    const augmentation = toConditionAugmentationTemplatePayload({
      values,
      augmentationId: "poison-pain",
      conditionId: "poisoned",
      conditionName: "Poisoned"
    });

    expect(upsertConditionAugmentationTemplate(condition(), augmentation)?.augmentation_ids).toEqual([
      "poison-drain",
      "poison-pain"
    ]);
    expect(removeConditionAugmentationTemplate(condition(), "poison-drain")?.augmentation_ids).toEqual([]);
  });
});
