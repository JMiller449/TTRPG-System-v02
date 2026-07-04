import { describe, expect, it } from "vitest";
import type { Augmentation } from "@/domain/models";
import {
  applyAugmentationTargetOption,
  augmentationEffectUsesTarget,
  augmentationEditorTargetKey,
  augmentationTargetOptionKey,
  createEmptyAugmentationEditorValues,
  formatAugmentationEffect,
  formatFormulaModifierSelector,
  formatAugmentationTargetOption,
  hasValidAugmentationEditorValues,
  isKnownAugmentationEditorTarget,
  toAugmentationEditorValues,
  toItemAugmentationTemplatePayload
} from "@/features/augmentations/augmentationEditorValues";

const testAugmentation: Augmentation = {
  id: "aug_1",
  name: "Arcane Guard",
  description: "Adds arcane defense while equipped.",
  source: {
    type: "item",
    id: "item_1",
    label: "Ward Ring"
  },
  scope: "instance",
  target: {
    root: "instance",
    path: ["resistances", "arcane", "resistance"]
  },
  effect: {
    operation: "add",
    value: {
      aliases: [
        {
          name: "arcane",
          path: ["sheet", "stats", "arcane"]
        }
      ],
      text: "@arcane + 2"
    },
    selector: {
      required_tags: ["damage", "arcane"],
      excluded_tags: ["healing"],
      action_id: "action_1",
      formula_id: "formula_1",
      step_id: "step_1",
      same_source_item: true
    },
    type: "formula_modifier"
  },
  active: true,
  applied: false,
  applied_target_id: null,
  lifecycle: {
    duration: "encounter",
    expires_at: null,
    removal_condition: "item removed"
  }
};

describe("augmentationEditorValues", () => {
  it("maps backend augmentation templates into editable values", () => {
    expect(toAugmentationEditorValues(testAugmentation)).toEqual({
      name: "Arcane Guard",
      description: "Adds arcane defense while equipped.",
      active: true,
      targetRoot: "instance",
      targetPath: ["resistances", "arcane", "resistance"],
      effectType: "formula_modifier",
      operation: "add",
      rollMode: "advantage",
      formulaText: "@arcane + 2",
      formulaAliases: [
        {
          name: "arcane",
          path: ["sheet", "stats", "arcane"]
        }
      ],
      selectorRequiredTags: ["damage", "arcane"],
      selectorExcludedTags: ["healing"],
      selectorActionId: "action_1",
      selectorFormulaId: "formula_1",
      selectorStepId: "step_1",
      selectorSameSourceItem: true,
      duration: "encounter",
      expiresAt: "",
      removalCondition: "item removed"
    });
  });

  it("builds evaluation-time numeric and roll-mode effects without mutating formulas", () => {
    const values = createEmptyAugmentationEditorValues();
    values.name = "Focused Strike";
    values.targetPath = ["health"];
    values.effectType = "evaluation_formula_modifier";
    values.operation = "add";
    values.formulaText = "2";
    values.selectorRequiredTags = ["damage"];

    expect(
      toItemAugmentationTemplatePayload({
        values,
        augmentationId: "focused-strike",
        itemId: "item_1",
        itemName: "Focus"
      }).effect
    ).toEqual({
      operation: "add",
      value: { aliases: null, text: "2" },
      selector: {
        required_tags: ["damage"],
        excluded_tags: [],
        action_id: null,
        formula_id: null,
        step_id: null,
        same_source_item: false
      },
      type: "evaluation_formula_modifier"
    });

    values.effectType = "roll_mode_modifier";
    values.rollMode = "disadvantage";
    values.formulaText = "";

    expect(hasValidAugmentationEditorValues(values)).toBe(true);
    expect(
      toItemAugmentationTemplatePayload({
        values,
        augmentationId: "hampered",
        itemId: "item_1",
        itemName: "Focus"
      }).effect
    ).toEqual({
      roll_mode: "disadvantage",
      selector: {
        required_tags: ["damage"],
        excluded_tags: [],
        action_id: null,
        formula_id: null,
        step_id: null,
        same_source_item: false
      },
      type: "roll_mode_modifier"
    });
  });

  it("builds item augmentation template payloads with item source metadata", () => {
    const values = createEmptyAugmentationEditorValues();
    values.name = "  Arcane Guard  ";
    values.description = " Adds arcane defense while equipped. ";
    values.targetRoot = "instance";
    values.targetPath = [" resistances ", "arcane", "", " resistance "];
    values.operation = "add";
    values.formulaText = " @arcane + 2 ";
    values.formulaAliases = [
      {
        name: "arcane",
        path: ["sheet", "stats", "arcane"]
      }
    ];
    values.selectorRequiredTags = [" Damage ", "ARCANE", "damage"];
    values.selectorExcludedTags = [" Healing "];
    values.selectorActionId = " action_1 ";
    values.selectorFormulaId = " formula_1 ";
    values.selectorStepId = " step_1 ";
    values.selectorSameSourceItem = true;
    values.duration = " encounter ";
    values.removalCondition = " item removed ";

    expect(
      toItemAugmentationTemplatePayload({
        values,
        augmentationId: "aug_1",
        itemId: "item_1",
        itemName: " Ward Ring "
      })
    ).toEqual({
      id: "aug_1",
      name: "Arcane Guard",
      description: "Adds arcane defense while equipped.",
      source: {
        type: "item",
        id: "item_1",
        label: "Ward Ring"
      },
      scope: "instance",
      target: {
        root: "instance",
        path: ["resistances", "arcane", "resistance"]
      },
      effect: {
        operation: "add",
        value: {
          aliases: [
            {
              name: "arcane",
              path: ["sheet", "stats", "arcane"]
            }
          ],
          text: "@arcane + 2"
        },
        selector: {
          required_tags: ["damage", "arcane"],
          excluded_tags: ["healing"],
          action_id: "action_1",
          formula_id: "formula_1",
          step_id: "step_1",
          same_source_item: true
        },
        type: "formula_modifier"
      },
      active: true,
      applied: false,
      applied_target_id: null,
      lifecycle: {
        duration: "encounter",
        expires_at: null,
        removal_condition: "item removed"
      }
    });
  });

  it("formats same-source item selector constraints", () => {
    expect(formatFormulaModifierSelector(testAugmentation)).toContain("same source item");
  });

  it("distinguishes direct targets from selector-only behavior", () => {
    const rollEffect: Augmentation = {
      ...testAugmentation,
      effect: {
        type: "roll_mode_modifier",
        roll_mode: "disadvantage",
        selector: { required_tags: ["check", "dodge"] }
      }
    };

    expect(augmentationEffectUsesTarget(testAugmentation)).toBe(true);
    expect(augmentationEffectUsesTarget(rollEffect)).toBe(false);
    expect(formatAugmentationEffect(rollEffect)).toBe("Disadvantage on matching rolls");
    expect(formatFormulaModifierSelector(rollEffect)).toBe("tags check + dodge");
  });

  it("uses the item target root as both backend target root and scope", () => {
    const values = createEmptyAugmentationEditorValues();
    values.name = "Sheet Bonus";
    values.targetRoot = "sheet";
    values.targetPath = ["stats", "arcane"];
    values.formulaText = "1";

    expect(
      toItemAugmentationTemplatePayload({
        values,
        augmentationId: "aug_sheet",
        itemId: "item_1",
        itemName: ""
      })
    ).toMatchObject({
      source: {
        type: "item",
        id: "item_1",
        label: null
      },
      scope: "sheet",
      target: {
        root: "sheet",
        path: ["stats", "arcane"]
      }
    });
  });

  it("requires a name, formula, and structured target path before submission", () => {
    const values = createEmptyAugmentationEditorValues();
    expect(hasValidAugmentationEditorValues(values)).toBe(false);

    values.name = "Arcane Guard";
    values.formulaText = "1";
    expect(hasValidAugmentationEditorValues(values)).toBe(false);

    values.targetPath = ["stats", "arcane"];
    expect(hasValidAugmentationEditorValues(values)).toBe(true);

    values.selectorRequiredTags = ["damage"];
    values.selectorExcludedTags = ["DAMAGE"];
    expect(hasValidAugmentationEditorValues(values)).toBe(false);
  });

  it("maps metadata target selections into editor target values", () => {
    const values = createEmptyAugmentationEditorValues();
    const target = {
      key: "sheet.stats.strength",
      label: "Strength",
      root: "sheet" as const,
      path: ["stats", "strength"],
      value_type: "number" as const,
      description: "Base sheet stat: Strength.",
      allowed_contexts: ["runtime" as const, "item_template" as const]
    };

    const nextValues = applyAugmentationTargetOption(values, target);

    expect(augmentationTargetOptionKey(target)).toBe("sheet.stats.strength");
    expect(formatAugmentationTargetOption(target)).toBe("Strength (sheet.stats.strength)");
    expect(augmentationEditorTargetKey(nextValues)).toBe("sheet.stats.strength");
    expect(nextValues.targetRoot).toBe("sheet");
    expect(nextValues.targetPath).toEqual(["stats", "strength"]);
    expect(isKnownAugmentationEditorTarget(nextValues, [target])).toBe(true);
    expect(isKnownAugmentationEditorTarget(values, [target])).toBe(false);
  });
});
