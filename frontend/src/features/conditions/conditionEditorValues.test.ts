import { describe, expect, it } from "vitest";
import type { ConditionPreset } from "@/domain/models";
import {
  createEmptyConditionPresetEditorValues,
  removeConditionEffect,
  toConditionAugmentationTemplatePayload,
  toConditionPresetEditorValues,
  toConditionPresetPayload,
  toUpdatedConditionPresetPayload,
  upsertConditionEffect
} from "@/features/conditions/conditionEditorValues";
import { createEmptyAugmentationEditorValues } from "@/features/augmentations/augmentationEditorValues";

function condition(): ConditionPreset {
  return {
    id: "poisoned",
    name: "Poisoned",
    description: "Takes poison penalties.",
    visibility: "gm_only",
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
      visibility: "gm_only",
      augmentationTemplates: condition().augmentation_templates
    });
  });

  it("builds condition preset payloads from editor values", () => {
    const values = createEmptyConditionPresetEditorValues();
    values.name = "  Burning  ";
    values.description = "  On fire.  ";

    expect(toConditionPresetPayload({ values, conditionId: "burning" })).toEqual({
      id: "burning",
      name: "Burning",
      description: "On fire.",
      visibility: "public",
      augmentation_templates: []
    });
  });

  it("preserves augmentation templates while updating condition metadata", () => {
    const values = toConditionPresetEditorValues(condition());
    values.name = "  Venomed  ";
    values.description = "  Updated description.  ";
    values.visibility = "public";

    expect(toUpdatedConditionPresetPayload(condition(), values)).toEqual({
      id: "poisoned",
      name: "Venomed",
      description: "Updated description.",
      visibility: "public",
      augmentation_templates: condition().augmentation_templates?.map((effect) => ({
        ...effect,
        source: {
          ...effect.source,
          label: "Venomed"
        },
        applied: false,
        applied_target_id: null
      }))
    });
  });

  it("builds condition augmentation templates as current-instance effects", () => {
    const values = createEmptyAugmentationEditorValues();
    values.name = "  Poison Drain  ";
    values.description = "  Weakens the target.  ";
    values.operation = "subtract";
    values.targetPath = [" stats ", " stamina "];
    values.formulaText = "  2  ";
    values.lifecycleMode = "manual";
    values.lifecycleNotes = "cured";

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
        selector: {
          required_tags: [],
          excluded_tags: [],
          action_id: null,
          formula_id: null,
          step_id: null,
          same_source_item: false
        },
        type: "formula_modifier"
      },
      active: true,
      applied: false,
      applied_target_id: null,
      lifecycle: {
        mode: "manual",
        remaining: null,
        expires_at: null,
        remove_when_source_inactive: false,
        notes: "cured"
      }
    });
  });

  it("upserts and removes draft effects while preserving stable ids", () => {
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

    if (!augmentation) {
      throw new Error("Expected a valid condition effect.");
    }

    const initialValues = toConditionPresetEditorValues(condition());
    const added = upsertConditionEffect(initialValues, augmentation);
    expect(added.augmentationTemplates.map((effect) => effect.id)).toEqual([
      "poison-drain",
      "poison-pain"
    ]);

    const replacement = { ...augmentation, name: "Severe Poison Pain" };
    const replaced = upsertConditionEffect(added, replacement);
    expect(replaced.augmentationTemplates).toHaveLength(2);
    expect(replaced.augmentationTemplates[1]?.name).toBe("Severe Poison Pain");

    expect(
      removeConditionEffect(replaced, "poison-drain").augmentationTemplates.map(
        (effect) => effect.id
      )
    ).toEqual(["poison-pain"]);
  });

  it("normalizes draft effect ownership in the final condition payload", () => {
    const values = toConditionPresetEditorValues(condition());
    values.name = "Venomed";

    const payload = toConditionPresetPayload({ values, conditionId: "venomed" });

    expect(payload.augmentation_templates?.[0]).toMatchObject({
      id: "poison-drain",
      source: {
        type: "condition",
        id: "venomed",
        label: "Venomed"
      },
      scope: "instance",
      target: { root: "instance" },
      applied: false,
      applied_target_id: null
    });
  });
});
