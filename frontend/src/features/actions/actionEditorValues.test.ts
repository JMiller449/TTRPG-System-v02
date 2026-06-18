import { describe, expect, it } from "vitest";
import type { ActionDefinition } from "@/domain/models";
import {
  addSendMessageActionStep,
  createEmptyActionEditorValues,
  moveSendMessageActionStep,
  removeSendMessageActionStep,
  toActionDefinitionPayload,
  toActionEditorValues,
  toUpdatedActionDefinitionPayload,
  updateSendMessageActionStepText
} from "@/features/actions/actionEditorValues";

function testAction(overrides: Partial<ActionDefinition> = {}): ActionDefinition {
  return {
    id: "action_1",
    name: "Mana Burst",
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

describe("actionEditorValues", () => {
  it("creates empty action editor values", () => {
    expect(createEmptyActionEditorValues()).toEqual({
      name: "",
      notes: "",
      steps: []
    });
  });

  it("maps backend action definitions into editor values with ordered steps preserved", () => {
    expect(toActionEditorValues(testAction())).toEqual({
      name: "Mana Burst",
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

  it("updates only send message step text and preserves aliases", () => {
    const values = toActionEditorValues(testAction());
    const result = updateSendMessageActionStepText(values, "step_message", "  /em edited message  ");

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

  it("removes only send message steps", () => {
    const values = toActionEditorValues(testAction());

    expect(removeSendMessageActionStep(values, "step_message").steps).toEqual([values.steps[1]]);
    expect(removeSendMessageActionStep(values, "step_mana").steps).toEqual(values.steps);
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
});
