import { describe, expect, it } from "vitest";
import type { StandaloneEffectDefinition } from "@/domain/models";
import {
  createEmptyAugmentationEditorValues,
  toAugmentationEditorValues
} from "@/features/augmentations/augmentationEditorValues";
import {
  hasValidStandaloneEffectValues,
  toStandaloneEffectDefinitionPayload
} from "@/features/effects/standaloneEffectEditorValues";

describe("standaloneEffectEditorValues", () => {
  it("builds a strict instance-scoped definition with normalized formulas and lifecycle notes", () => {
    const values = createEmptyAugmentationEditorValues();
    values.name = "  Burning weapon  ";
    values.description = " Adds fire damage. ";
    values.targetPath = [" resources ", "", "health"];
    values.effectType = "evaluation_formula_modifier";
    values.operation = "add";
    values.formulaText = " 2 ";
    values.formulaAliases = [{ name: "arcane", path: ["sheet", "stats", "arcane"] }];
    values.selectorRequiredTags = [" Fire ", "attack", "fire"];
    values.selectorExcludedTags = ["healing"];
    values.lifecycleMode = "manual";
    values.lifecycleNotes = " action removes effect ";

    expect(hasValidStandaloneEffectValues(values)).toBe(true);
    expect(toStandaloneEffectDefinitionPayload(values, "effect_1")).toEqual({
      id: "effect_1",
      name: "Burning weapon",
      description: "Adds fire damage.",
      scope: "instance",
      target: { root: "instance", path: ["resources", "health"] },
      effect: {
        operation: "add",
        value: {
          aliases: [{ name: "arcane", path: ["sheet", "stats", "arcane"] }],
          text: "2"
        },
        selector: {
          required_tags: ["fire", "attack"],
          excluded_tags: ["healing"],
          action_id: null,
          formula_id: null,
          step_id: null,
          same_source_item: false
        },
        type: "evaluation_formula_modifier"
      },
      active: true,
      lifecycle: {
        mode: "manual",
        remaining: null,
        expires_at: null,
        remove_when_source_inactive: false,
        notes: "action removes effect"
      },
      stacking: {
        mode: "unique",
        max_stacks: null
      }
    });
  });

  it("builds a stacking config with max_stacks when stacking mode is stack", () => {
    const values = createEmptyAugmentationEditorValues();
    values.name = "Bleeding";
    values.formulaText = "1";
    values.targetPath = ["resources", "health"];
    values.stackingMode = "stack";
    values.stackingMaxStacks = "3";

    expect(toStandaloneEffectDefinitionPayload(values, "effect_1").stacking).toEqual({
      mode: "stack",
      max_stacks: 3
    });
  });

  it("rejects sheet targets and hydrates standalone definitions through the shared editor", () => {
    const values = createEmptyAugmentationEditorValues();
    values.name = "Blocked";
    values.formulaText = "2";
    values.targetRoot = "sheet";
    values.targetPath = ["stats", "arcane"];
    expect(hasValidStandaloneEffectValues(values)).toBe(false);

    const definition: StandaloneEffectDefinition = {
      id: "effect_1",
      name: "Focused",
      description: "Action-controlled focus.",
      scope: "instance",
      target: { root: "instance", path: ["resources", "health"] },
      effect: {
        type: "roll_mode_modifier",
        roll_mode: "advantage",
        selector: {
          required_tags: ["attack"],
          excluded_tags: [],
          action_id: null,
          formula_id: null,
          step_id: null,
          same_source_item: false
        }
      },
      active: false,
      lifecycle: {
        mode: "manual",
        remaining: null,
        expires_at: "end of scene",
        remove_when_source_inactive: false,
        notes: null
      }
    };

    expect(toAugmentationEditorValues(definition)).toMatchObject({
      name: "Focused",
      active: false,
      targetRoot: "instance",
      targetPath: ["resources", "health"],
      effectType: "roll_mode_modifier",
      rollMode: "advantage",
      selectorRequiredTags: ["attack"],
      expiresAt: "end of scene"
    });
  });
});
