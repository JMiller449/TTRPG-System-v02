import { describe, expect, it } from "vitest";
import {
  buildLoadItemAugmentationTargetMetadataSubmission,
  buildRemoveItemAugmentationTemplateSubmission
} from "@/features/augmentations/augmentationRequests";

describe("legacy item augmentation requests", () => {
  it("loads item target metadata for compatibility authoring routes", () => {
    expect(buildLoadItemAugmentationTargetMetadataSubmission()).toEqual({
      request: { type: "get_augmentation_target_metadata", context: "item_template" },
      label: "Load item augmentation targets"
    });
  });

  it("builds a detach request using the stable legacy route", () => {
    expect(
      buildRemoveItemAugmentationTemplateSubmission({
        item: {
          id: "helm",
          name: "Helm",
          interaction_type: "equippable",
          description: "",
          price: "",
          weight: 1,
          effect_ids: ["fire_focus"]
        },
        augmentationId: "fire_focus"
      })
    ).toMatchObject({
      request: {
        type: "remove_item_augmentation_template",
        item_id: "helm",
        augmentation_id: "fire_focus"
      }
    });
  });
});
