import { describe, expect, it } from "vitest";
import type { Augmentation } from "@/domain/models";
import {
  createEmptyAugmentationEditorValues,
  hasValidAugmentationEditorValues,
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
      operation: "add",
      formulaText: "@arcane + 2",
      formulaAliases: [
        {
          name: "arcane",
          path: ["sheet", "stats", "arcane"]
        }
      ],
      duration: "encounter",
      expiresAt: "",
      removalCondition: "item removed"
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
  });
});
