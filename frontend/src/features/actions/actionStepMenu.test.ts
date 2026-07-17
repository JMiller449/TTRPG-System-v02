import { describe, expect, it } from "vitest";
import { createEmptyActionEditorValues } from "@/features/actions/actionEditorValues";
import {
  addActionStepFromMenu,
  buildActionStepMenuOptions
} from "@/features/actions/actionStepMenu";

describe("actionStepMenu", () => {
  it("groups every supported step and explains unavailable dependencies", () => {
    const options = buildActionStepMenuOptions({});

    expect(options).toHaveLength(10);
    expect(options.find((option) => option.type === "send_roll")?.group).toBe(
      "Calculation & Output"
    );
    expect(options.find((option) => option.type === "send_message")?.group).toBe(
      "Calculation & Output"
    );
    expect(
      options.find((option) => option.type === "gain_proficiency_use")?.unavailableReason
    ).toBe("no proficiencies authored");
    expect(options.find((option) => option.type === "apply_augmentation")?.unavailableReason).toBe(
      "no standalone effects authored"
    );
    expect(
      options.find((option) => option.type === "apply_condition_preset")?.unavailableReason
    ).toBe("no conditions authored");
  });

  it("adds selected steps with current dependency defaults", () => {
    const dependencies = {
      mutationTargetPath: ["instance", "mana"],
      proficiencyId: "longsword",
      augmentationId: "blessed",
      conditionId: "poisoned"
    };
    const initial = createEmptyActionEditorValues();
    const calculated = addActionStepFromMenu({
      values: initial,
      type: "calculate_value",
      stepId: "calculate_1",
      dependencies
    });
    if (!calculated) {
      throw new Error("Expected calculation step insertion.");
    }
    const secondCalculation = addActionStepFromMenu({
      values: calculated,
      type: "calculate_value",
      stepId: "calculate_2",
      dependencies
    });
    expect(secondCalculation?.steps.map((step) => step.type)).toEqual([
      "calculate_value",
      "calculate_value"
    ]);
    expect(
      secondCalculation?.steps
        .filter((step) => step.type === "calculate_value")
        .map((step) => step.variable_id)
    ).toEqual(["value_1", "value_2"]);

    const condition = addActionStepFromMenu({
      values: secondCalculation ?? calculated,
      type: "apply_condition_preset",
      stepId: "condition_1",
      dependencies
    });
    expect(condition?.steps.at(-1)).toMatchObject({
      step_id: "condition_1",
      type: "apply_condition_preset",
      condition_id: "poisoned"
    });
  });

  it("does not add a step when its dependency is unavailable", () => {
    expect(
      addActionStepFromMenu({
        values: createEmptyActionEditorValues(),
        type: "gain_proficiency_use",
        stepId: "proficiency_1",
        dependencies: {}
      })
    ).toBeNull();
  });
});
