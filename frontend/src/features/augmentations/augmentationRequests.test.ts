import { describe, expect, it } from "vitest";
import type { ItemDefinition } from "@/domain/models";
import {
  createEmptyAugmentationEditorValues
} from "@/features/augmentations/augmentationEditorValues";
import {
  buildLoadItemAugmentationTargetMetadataSubmission,
  buildRemoveItemAugmentationTemplateSubmission,
  buildUpsertItemAugmentationTemplateSubmission,
  selectItemAugmentationTemplates
} from "@/features/augmentations/augmentationRequests";

function testItem(overrides: Partial<ItemDefinition> = {}): ItemDefinition {
  return {
    id: "item_1",
    name: "Ward Ring",
    description: "Rank C ring.",
    price: "100CP",
    weight: "1LBS",
    augmentation_templates: [],
    ...overrides
  };
}

describe("augmentationRequests", () => {
  it("selects item augmentation templates from authoritative item definitions", () => {
    const templates = [
      {
        id: "aug_1",
        name: "Arcane Guard",
        source: { type: "item" as const, id: "item_1" },
        scope: "instance" as const,
        target: { root: "instance" as const, path: ["stats", "arcane"] },
        effect: {
          operation: "add" as const,
          value: { aliases: null, text: "1" },
          type: "formula_modifier" as const
        }
      }
    ];

    expect(selectItemAugmentationTemplates(testItem({ augmentation_templates: templates }))).toEqual(templates);
    expect(selectItemAugmentationTemplates(undefined)).toEqual([]);
  });

  it("builds item augmentation target metadata load submissions", () => {
    expect(buildLoadItemAugmentationTargetMetadataSubmission()).toEqual({
      request: {
        type: "get_augmentation_target_metadata",
        context: "item_template"
      },
      label: "Load item augmentation targets"
    });
  });

  it("builds upsert submissions for valid item augmentation templates", () => {
    const values = createEmptyAugmentationEditorValues();
    values.name = "  Arcane Guard  ";
    values.description = " Adds arcane defense. ";
    values.targetRoot = "instance";
    values.targetPath = ["stats", "arcane"];
    values.operation = "add";
    values.formulaText = " 2 ";

    expect(
      buildUpsertItemAugmentationTemplateSubmission({
        item: testItem(),
        values,
        augmentationId: "aug_1"
      })
    ).toEqual({
      request: {
        type: "upsert_item_augmentation_template",
        item_id: "item_1",
        augmentation: {
          id: "aug_1",
          name: "Arcane Guard",
          description: "Adds arcane defense.",
          source: {
            type: "item",
            id: "item_1",
            label: "Ward Ring"
          },
          scope: "instance",
          target: {
            root: "instance",
            path: ["stats", "arcane"]
          },
          effect: {
            operation: "add",
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
            duration: null,
            expires_at: null,
            removal_condition: null
          }
        }
      },
      label: "Save augmentation: Arcane Guard"
    });
  });

  it("does not build upsert submissions without an item or valid values", () => {
    const values = createEmptyAugmentationEditorValues();
    values.name = "Arcane Guard";
    values.formulaText = "2";

    expect(
      buildUpsertItemAugmentationTemplateSubmission({
        item: undefined,
        values,
        augmentationId: "aug_1"
      })
    ).toBeNull();
    expect(
      buildUpsertItemAugmentationTemplateSubmission({
        item: testItem(),
        values,
        augmentationId: "aug_1"
      })
    ).toBeNull();
  });

  it("builds remove submissions with template labels and fallbacks", () => {
    const item = testItem({
      augmentation_templates: [
        {
          id: "aug_1",
          name: "Arcane Guard",
          source: { type: "item", id: "item_1" },
          scope: "instance",
          target: { root: "instance", path: ["stats", "arcane"] },
          effect: {
            operation: "add",
            value: { aliases: null, text: "1" },
            type: "formula_modifier"
          }
        }
      ]
    });

    expect(
      buildRemoveItemAugmentationTemplateSubmission({
        item,
        augmentationId: "aug_1"
      })
    ).toEqual({
      request: {
        type: "remove_item_augmentation_template",
        item_id: "item_1",
        augmentation_id: "aug_1"
      },
      label: "Remove augmentation: Arcane Guard"
    });

    expect(
      buildRemoveItemAugmentationTemplateSubmission({
        item,
        augmentationId: "missing"
      })
    ).toEqual({
      request: {
        type: "remove_item_augmentation_template",
        item_id: "item_1",
        augmentation_id: "missing"
      },
      label: "Remove augmentation: augmentation"
    });
  });

  it("does not build remove submissions without an item or augmentation id", () => {
    expect(
      buildRemoveItemAugmentationTemplateSubmission({
        item: undefined,
        augmentationId: "aug_1"
      })
    ).toBeNull();
    expect(
      buildRemoveItemAugmentationTemplateSubmission({
        item: testItem(),
        augmentationId: "   "
      })
    ).toBeNull();
  });
});
