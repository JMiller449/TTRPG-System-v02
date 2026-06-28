import { describe, expect, it } from "vitest";
import { buildAugmentationSelectorOptions } from "@/features/augmentations/augmentationSelectorOptions";

describe("augmentationSelectorOptions", () => {
  it("derives authoritative ID options and discovered formula tags", () => {
    const options = buildAugmentationSelectorOptions({
      actionRecords: {
        action_1: {
          id: "action_1",
          name: "Fire Strike",
          steps: [
            {
              step_id: "damage_step",
              type: "resolve_damage",
              damage_type: "Fire",
              amount: { aliases: null, text: "5", tags: ["damage", "custom action tag"] }
            }
          ]
        }
      },
      actionOrder: ["missing", "action_1"],
      formulaRecords: {
        formula_1: {
          id: "formula_1",
          formula: { aliases: null, text: "1d100", tags: ["check", "custom global tag"] }
        }
      },
      formulaOrder: ["formula_1", "missing"]
    });

    expect(options.actions).toEqual([{ id: "action_1", label: "Fire Strike (action_1)" }]);
    expect(options.formulas).toEqual([{ id: "formula_1", label: "formula_1" }]);
    expect(options.steps).toEqual([
      {
        id: "damage_step",
        actionId: "action_1",
        label: "Fire Strike: damage_step (resolve_damage)"
      }
    ]);
    expect(options.tags).toEqual(
      expect.arrayContaining(["damage", "check", "custom action tag", "custom global tag"])
    );
  });
});
