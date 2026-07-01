import { describe, expect, it } from "vitest";
import type { StandaloneEffectDefinition } from "@/domain/models";
import { createEmptyAugmentationEditorValues } from "@/features/augmentations/augmentationEditorValues";
import {
  buildCreateStandaloneEffectSubmission,
  buildDeleteStandaloneEffectSubmission,
  buildLoadStandaloneEffectFormulaMetadataSubmission,
  buildLoadStandaloneEffectTargetMetadataSubmission,
  buildUpdateStandaloneEffectSubmission,
  selectOrderedStandaloneEffects
} from "@/features/effects/standaloneEffectAuthoringRequests";

function validValues() {
  const values = createEmptyAugmentationEditorValues();
  values.name = "Focused";
  values.targetPath = ["resources", "health"];
  values.formulaText = "2";
  return values;
}

const effect: StandaloneEffectDefinition = {
  id: "effect_1",
  name: "Focused",
  scope: "instance",
  target: { root: "instance", path: ["resources", "health"] },
  effect: {
    type: "formula_modifier",
    operation: "add",
    value: { text: "2", aliases: null, tags: [] },
    selector: {
      required_tags: [],
      excluded_tags: [],
      action_id: null,
      formula_id: null,
      step_id: null
    }
  }
};

describe("standaloneEffectAuthoringRequests", () => {
  it("builds metadata and CRUD requests from the standalone definition contract", () => {
    expect(buildLoadStandaloneEffectTargetMetadataSubmission().request).toEqual({
      type: "get_augmentation_target_metadata",
      context: "runtime"
    });
    expect(buildLoadStandaloneEffectFormulaMetadataSubmission().request).toEqual({
      type: "get_action_formula_authoring_metadata"
    });

    const create = buildCreateStandaloneEffectSubmission(validValues(), "effect_1");
    expect(create?.request).toMatchObject({
      type: "create_standalone_effect",
      effect: { id: "effect_1", name: "Focused", scope: "instance" }
    });

    const updatedValues = validValues();
    updatedValues.name = "Focused Strike";
    expect(buildUpdateStandaloneEffectSubmission(effect, updatedValues)?.request).toMatchObject({
      type: "update_standalone_effect",
      effect_id: "effect_1",
      effect: { id: "effect_1", name: "Focused Strike" }
    });

    const deletion = buildDeleteStandaloneEffectSubmission(effect.id, effect);
    expect(deletion.request).toEqual({
      type: "delete_standalone_effect",
      effect_id: "effect_1"
    });
    expect(deletion.confirmation).toContain("referenced by actions");
  });

  it("rejects invalid drafts and follows authoritative ordering", () => {
    expect(
      buildCreateStandaloneEffectSubmission(createEmptyAugmentationEditorValues(), "bad")
    ).toBeNull();
    expect(buildUpdateStandaloneEffectSubmission(undefined, validValues())).toBeNull();
    expect(selectOrderedStandaloneEffects({ effect_1: effect }, ["missing", "effect_1"])).toEqual([
      effect
    ]);
  });
});
