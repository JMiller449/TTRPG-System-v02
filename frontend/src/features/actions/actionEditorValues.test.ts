import { describe, expect, it } from "vitest";
import type {
  ActionDefinition,
  DamageType,
  GainProficiencyUseActionStep,
  ResolveDamageActionStep
} from "@/domain/models";
import {
  addCalculateValueActionStep,
  addGainProficiencyUseActionStep,
  addIncrementValueActionStep,
  addResolveDamageActionStep,
  addSendMessageActionStep,
  calculatedValuesBeforeStep,
  createCalculateValueActionStep,
  createGainProficiencyUseActionStep,
  createResolveDamageActionStep,
  createEmptyActionEditorValues,
  isCalculatedValueReference,
  moveActionStep,
  moveGainProficiencyUseActionStep,
  moveResolveDamageActionStep,
  moveSendMessageActionStep,
  removeGainProficiencyUseActionStep,
  removeCalculateValueActionStep,
  removeResolveDamageActionStep,
  removeSendMessageActionStep,
  setNumericStepCalculatedValue,
  toActionDefinitionPayload,
  toActionEditorValues,
  toUpdatedActionDefinitionPayload,
  updateResolveDamageActionStep,
  updateResolveDamageActionStepFormula,
  updateGainProficiencyUseActionStep,
  updateGainProficiencyUseActionStepFormula,
  updateCalculateValueActionStep,
  updateSendMessageActionStepFormula,
  updateSendMessageActionStepText
} from "@/features/actions/actionEditorValues";

function testAction(overrides: Partial<ActionDefinition> = {}): ActionDefinition {
  return {
    id: "action_1",
    name: "Mana Burst",
    roll_mode_kind: "check",
    notes: "Roll20 output and mana spend.",
    steps: [
      {
        step_id: "step_message",
        type: "send_message",
        message: {
          aliases: [
            {
              name: "arcane",
              path: ["sheet", "stats", "arcane"]
            }
          ],
          text: "/em releases a mana burst with @arcane power."
        }
      },
      {
        step_id: "step_mana",
        type: "decrement_value",
        target: "caster",
        path: ["instance", "mana"],
        amount: {
          aliases: null,
          text: "5"
        },
        min_value: {
          aliases: null,
          text: "0"
        },
        max_value: null,
        on_min_violation: "reject",
        on_max_violation: "clamp"
      }
    ],
    ...overrides
  };
}

function testResolveDamageStep(
  stepId: string,
  amountText: string,
  damageType: DamageType
): ResolveDamageActionStep {
  return {
    step_id: stepId,
    type: "resolve_damage",
    target: "caster",
    damage_type: damageType,
    amount: {
      aliases: null,
      text: amountText
    }
  };
}

function testGainProficiencyUseStep(
  stepId: string,
  proficiencyId: string,
  amountText = "1"
): GainProficiencyUseActionStep {
  return {
    step_id: stepId,
    type: "gain_proficiency_use",
    target: "caster",
    proficiency_id: proficiencyId,
    amount: {
      aliases: null,
      text: amountText
    }
  };
}

describe("actionEditorValues", () => {
  it("creates empty action editor values", () => {
    expect(createEmptyActionEditorValues()).toEqual({
      name: "",
      rollModeKind: "none",
      notes: "",
      steps: []
    });
  });

  it("maps backend action definitions into editor values with ordered steps preserved", () => {
    expect(toActionEditorValues(testAction())).toEqual({
      name: "Mana Burst",
      rollModeKind: "check",
      notes: "Roll20 output and mana spend.",
      steps: testAction().steps
    });
  });

  it("maps new editor values to backend action payloads", () => {
    const values = createEmptyActionEditorValues();
    values.name = "  Mana Burst  ";
    values.notes = "  Roll20 output only.  ";

    expect(toActionDefinitionPayload(values, "action_created")).toEqual({
      id: "action_created",
      name: "Mana Burst",
      roll_mode_kind: "none",
      notes: "Roll20 output only.",
      steps: []
    });
  });

  it("maps action edits to backend payloads without dropping or reordering steps", () => {
    const action = testAction();
    const values = toActionEditorValues(action);
    values.name = "  Edited Mana Burst  ";
    values.notes = "  Updated notes.  ";

    expect(toUpdatedActionDefinitionPayload(action, values)).toEqual({
      id: "action_1",
      name: "Edited Mana Burst",
      roll_mode_kind: "check",
      notes: "Updated notes.",
      steps: action.steps
    });
  });

  it("clones nested step records so editor mutations do not mutate the authoritative action", () => {
    const action = testAction();
    const values = toActionEditorValues(action);
    const firstStep = values.steps[0];
    if (firstStep?.type === "send_message") {
      firstStep.message.aliases?.[0]?.path.push("mutated");
    }

    const authoritativeStep = action.steps?.[0];
    expect(authoritativeStep?.type).toBe("send_message");
    if (authoritativeStep?.type === "send_message") {
      expect(authoritativeStep.message.aliases?.[0]?.path).toEqual(["sheet", "stats", "arcane"]);
    }
  });

  it("adds send message steps with generated ids and empty formula text", () => {
    const values = createEmptyActionEditorValues();

    expect(addSendMessageActionStep(values, "step_created")).toEqual({
      name: "",
      rollModeKind: "none",
      notes: "",
      steps: [
        {
          step_id: "step_created",
          type: "send_message",
          message: {
            aliases: null,
            text: ""
          }
        }
      ]
    });
  });

  it("adds resolve damage steps with canonical damage defaults", () => {
    const values = createEmptyActionEditorValues();

    expect(addResolveDamageActionStep(values, "damage_created")).toEqual({
      name: "",
      rollModeKind: "none",
      notes: "",
      steps: [
        {
          step_id: "damage_created",
          type: "resolve_damage",
          target: "caster",
          damage_type: "Slashing",
          amount: {
            aliases: null,
            text: ""
          }
        }
      ]
    });

    expect(createResolveDamageActionStep("damage_fire", "10", "Fire")).toEqual({
      step_id: "damage_fire",
      type: "resolve_damage",
      target: "caster",
      damage_type: "Fire",
      amount: {
        aliases: null,
        text: "10"
      }
    });
  });

  it("adds proficiency gain steps with a selected proficiency and default amount", () => {
    const values = createEmptyActionEditorValues();

    expect(addGainProficiencyUseActionStep(values, "prof_created", "longsword")).toEqual({
      name: "",
      rollModeKind: "none",
      notes: "",
      steps: [
        {
          step_id: "prof_created",
          type: "gain_proficiency_use",
          target: "caster",
          proficiency_id: "longsword",
          amount: {
            aliases: null,
            text: "1"
          }
        }
      ]
    });

    expect(createGainProficiencyUseActionStep("prof_magic", "magic", "2")).toEqual({
      step_id: "prof_magic",
      type: "gain_proficiency_use",
      target: "caster",
      proficiency_id: "magic",
      amount: {
        aliases: null,
        text: "2"
      }
    });
  });

  it("updates only send message step text and preserves aliases", () => {
    const values = toActionEditorValues(testAction());
    const result = updateSendMessageActionStepText(
      values,
      "step_message",
      "  /em edited message  "
    );

    expect(result.steps[0]).toEqual({
      step_id: "step_message",
      type: "send_message",
      message: {
        aliases: [
          {
            name: "arcane",
            path: ["sheet", "stats", "arcane"]
          }
        ],
        text: "  /em edited message  "
      }
    });
    expect(result.steps[1]).toEqual(values.steps[1]);
  });

  it("updates send message formula text and aliases together", () => {
    const values = toActionEditorValues(testAction());
    const result = updateSendMessageActionStepFormula(values, "step_message", {
      messageText: "/em uses @mana",
      aliases: [
        {
          name: "mana",
          path: ["instance", "mana"]
        }
      ],
      tags: [" Message ", "CHECK", "message"]
    });

    expect(result.steps[0]).toEqual({
      step_id: "step_message",
      type: "send_message",
      message: {
        aliases: [
          {
            name: "mana",
            path: ["instance", "mana"]
          }
        ],
        text: "/em uses @mana",
        tags: ["message", "check"]
      }
    });
    expect(result.steps[1]).toEqual(values.steps[1]);
  });

  it("updates only resolve damage step fields and preserves amount aliases", () => {
    const values = toActionEditorValues(
      testAction({
        steps: [
          {
            step_id: "damage",
            type: "resolve_damage",
            target: "caster",
            damage_type: "Fire",
            amount: {
              aliases: [
                {
                  name: "arcane",
                  path: ["sheet", "stats", "arcane"]
                }
              ],
              text: "@arcane"
            }
          },
          {
            step_id: "step_message",
            type: "send_message",
            message: {
              aliases: null,
              text: "message"
            }
          }
        ]
      })
    );

    const result = updateResolveDamageActionStep(values, "damage", {
      damageType: "Arcane",
      amountText: "@arcane * 2"
    });

    expect(result.steps[0]).toEqual({
      step_id: "damage",
      type: "resolve_damage",
      target: "caster",
      damage_type: "Arcane",
      amount: {
        aliases: [
          {
            name: "arcane",
            path: ["sheet", "stats", "arcane"]
          }
        ],
        text: "@arcane * 2"
      }
    });
    expect(result.steps[1]).toEqual(values.steps[1]);
  });

  it("updates resolve damage formula text and aliases together", () => {
    const values = toActionEditorValues(
      testAction({
        steps: [testResolveDamageStep("damage", "5", "Fire")]
      })
    );

    expect(
      updateResolveDamageActionStepFormula(values, "damage", {
        amountText: "@arc * 2",
        aliases: [
          {
            name: "arc",
            path: ["sheet", "stats", "arcane"]
          }
        ],
        tags: [" Damage ", "FIRE", "damage"]
      }).steps[0]
    ).toEqual({
      step_id: "damage",
      type: "resolve_damage",
      target: "caster",
      damage_type: "Fire",
      amount: {
        aliases: [
          {
            name: "arc",
            path: ["sheet", "stats", "arcane"]
          }
        ],
        text: "@arc * 2",
        tags: ["damage", "fire"]
      }
    });
  });

  it("updates proficiency gain fields and preserves amount aliases", () => {
    const values = toActionEditorValues(
      testAction({
        steps: [
          {
            ...testGainProficiencyUseStep("prof", "longsword", "@arcane"),
            amount: {
              aliases: [
                {
                  name: "arcane",
                  path: ["sheet", "stats", "arcane"]
                }
              ],
              text: "@arcane"
            }
          }
        ]
      })
    );

    const result = updateGainProficiencyUseActionStep(values, "prof", {
      proficiencyId: "greatsword",
      amountText: "@arcane + 1"
    });

    expect(result.steps[0]).toEqual({
      step_id: "prof",
      type: "gain_proficiency_use",
      target: "caster",
      proficiency_id: "greatsword",
      amount: {
        aliases: [
          {
            name: "arcane",
            path: ["sheet", "stats", "arcane"]
          }
        ],
        text: "@arcane + 1"
      }
    });
  });

  it("updates proficiency gain formula text and aliases together", () => {
    const values = toActionEditorValues(
      testAction({
        steps: [testGainProficiencyUseStep("prof", "longsword")]
      })
    );

    expect(
      updateGainProficiencyUseActionStepFormula(values, "prof", {
        amountText: "@focus",
        aliases: [
          {
            name: "focus",
            path: ["sheet", "stats", "will"]
          }
        ],
        tags: [" Progression ", "CHECK", "progression"]
      }).steps[0]
    ).toEqual({
      step_id: "prof",
      type: "gain_proficiency_use",
      target: "caster",
      proficiency_id: "longsword",
      amount: {
        aliases: [
          {
            name: "focus",
            path: ["sheet", "stats", "will"]
          }
        ],
        text: "@focus",
        tags: ["progression", "check"]
      }
    });
  });

  it("preserves inline formula tags when editing non-tag fields", () => {
    const values = toActionEditorValues(
      testAction({
        steps: [
          {
            step_id: "message",
            type: "send_message",
            message: { aliases: null, text: "message", tags: ["check"] }
          },
          {
            ...testResolveDamageStep("damage", "5", "Fire"),
            amount: { aliases: null, text: "5", tags: ["damage", "fire"] }
          },
          {
            ...testGainProficiencyUseStep("prof", "longsword"),
            amount: { aliases: null, text: "1", tags: ["progression"] }
          }
        ]
      })
    );

    const messageResult = updateSendMessageActionStepText(values, "message", "updated");
    const damageResult = updateResolveDamageActionStep(values, "damage", { amountText: "10" });
    const proficiencyResult = updateGainProficiencyUseActionStep(values, "prof", {
      amountText: "2"
    });

    expect(
      messageResult.steps[0]?.type === "send_message" && messageResult.steps[0].message.tags
    ).toEqual(["check"]);
    expect(
      damageResult.steps[1]?.type === "resolve_damage" &&
        !isCalculatedValueReference(damageResult.steps[1].amount) &&
        damageResult.steps[1].amount.tags
    ).toEqual(["damage", "fire"]);
    expect(
      proficiencyResult.steps[2]?.type === "gain_proficiency_use" &&
        !isCalculatedValueReference(proficiencyResult.steps[2].amount) &&
        proficiencyResult.steps[2].amount.tags
    ).toEqual(["progression"]);
  });

  it("removes only send message steps", () => {
    const values = toActionEditorValues(testAction());

    expect(removeSendMessageActionStep(values, "step_message").steps).toEqual([values.steps[1]]);
    expect(removeSendMessageActionStep(values, "step_mana").steps).toEqual(values.steps);
  });

  it("removes only resolve damage steps", () => {
    const values = toActionEditorValues(
      testAction({
        steps: [
          testResolveDamageStep("damage", "5", "Fire"),
          {
            step_id: "step_message",
            type: "send_message",
            message: {
              aliases: null,
              text: "message"
            }
          }
        ]
      })
    );

    expect(removeResolveDamageActionStep(values, "damage").steps).toEqual([values.steps[1]]);
    expect(removeResolveDamageActionStep(values, "step_message").steps).toEqual(values.steps);
  });

  it("removes only proficiency gain steps", () => {
    const values = toActionEditorValues(
      testAction({
        steps: [
          testGainProficiencyUseStep("prof", "longsword"),
          {
            step_id: "step_message",
            type: "send_message",
            message: {
              aliases: null,
              text: "message"
            }
          }
        ]
      })
    );

    expect(removeGainProficiencyUseActionStep(values, "prof").steps).toEqual([values.steps[1]]);
    expect(removeGainProficiencyUseActionStep(values, "step_message").steps).toEqual(values.steps);
  });

  it("reorders send message steps without moving non-message step slots", () => {
    const values = toActionEditorValues(
      testAction({
        steps: [
          {
            step_id: "step_message_1",
            type: "send_message",
            message: {
              aliases: null,
              text: "first"
            }
          },
          {
            step_id: "step_mana",
            type: "decrement_value",
            target: "caster",
            path: ["instance", "mana"],
            amount: {
              aliases: null,
              text: "5"
            }
          },
          {
            step_id: "step_message_2",
            type: "send_message",
            message: {
              aliases: null,
              text: "second"
            }
          }
        ]
      })
    );

    expect(moveSendMessageActionStep(values, "step_message_2", "up").steps).toEqual([
      values.steps[2],
      values.steps[1],
      values.steps[0]
    ]);
    expect(moveSendMessageActionStep(values, "step_message_1", "up").steps).toEqual(values.steps);
  });

  it("reorders resolve damage steps without moving other step slots", () => {
    const values = toActionEditorValues(
      testAction({
        steps: [
          testResolveDamageStep("damage_1", "5", "Fire"),
          {
            step_id: "step_message",
            type: "send_message",
            message: {
              aliases: null,
              text: "message"
            }
          },
          testResolveDamageStep("damage_2", "8", "Arcane")
        ]
      })
    );

    expect(moveResolveDamageActionStep(values, "damage_2", "up").steps).toEqual([
      values.steps[2],
      values.steps[1],
      values.steps[0]
    ]);
    expect(moveResolveDamageActionStep(values, "damage_1", "up").steps).toEqual(values.steps);
  });

  it("reorders proficiency gain steps without moving other step slots", () => {
    const values = toActionEditorValues(
      testAction({
        steps: [
          testGainProficiencyUseStep("prof_1", "longsword"),
          {
            step_id: "step_message",
            type: "send_message",
            message: {
              aliases: null,
              text: "message"
            }
          },
          testGainProficiencyUseStep("prof_2", "greatsword")
        ]
      })
    );

    expect(moveGainProficiencyUseActionStep(values, "prof_2", "up").steps).toEqual([
      values.steps[2],
      values.steps[1],
      values.steps[0]
    ]);
    expect(moveGainProficiencyUseActionStep(values, "prof_1", "up").steps).toEqual(values.steps);
  });

  it("authors immutable calculated values and exposes only earlier declarations", () => {
    let values = createEmptyActionEditorValues();
    values = addCalculateValueActionStep(values, "calculate_healing", "healing_amount");
    values = updateCalculateValueActionStep(values, "calculate_healing", {
      formulaText: "1d8 + 2",
      tags: [" Healing "]
    });
    values = addIncrementValueActionStep(values, "apply_healing", ["health"]);
    values = setNumericStepCalculatedValue(values, "apply_healing", "healing_amount");
    values = addCalculateValueActionStep(values, "calculate_total", "total_amount");

    expect(createCalculateValueActionStep("calculate", "amount", "5")).toEqual({
      step_id: "calculate",
      variable_id: "amount",
      value: { aliases: null, text: "5" },
      type: "calculate_value"
    });
    expect(calculatedValuesBeforeStep(values, "apply_healing")).toEqual([
      { stepId: "calculate_healing", variableId: "healing_amount" }
    ]);
    expect(calculatedValuesBeforeStep(values, "calculate_healing")).toEqual([]);
    expect(values.steps[0]).toMatchObject({
      variable_id: "healing_amount",
      value: { text: "1d8 + 2", tags: ["healing"] }
    });
    expect(values.steps[1]).toMatchObject({
      type: "increment_value",
      amount: { type: "calculated_value", variable_id: "healing_amount" }
    });
  });

  it("moves and removes calculate steps without creating implicit mutation outputs", () => {
    let values = createEmptyActionEditorValues();
    values = addSendMessageActionStep(values, "message");
    values = addCalculateValueActionStep(values, "calculate", "amount");

    expect(moveActionStep(values, "calculate", "up").steps.map((step) => step.step_id)).toEqual([
      "calculate",
      "message"
    ]);
    expect(removeCalculateValueActionStep(values, "calculate").steps).toEqual([
      values.steps[0]
    ]);
  });
});
