import { describe, expect, it } from "vitest";
import type { ActionDefinition } from "@/domain/models";
import { createEmptyActionEditorValues, toActionEditorValues } from "@/features/actions/actionEditorValues";
import {
  buildCreateActionSubmission,
  buildDeleteActionSubmission,
  buildLoadActionFormulaAuthoringMetadataSubmission,
  buildUpdateActionSubmission,
  selectOrderedActionDefinitions
} from "@/features/actions/actionAuthoringRequests";

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
          aliases: null,
          text: "/em releases a mana burst."
        }
      }
    ],
    ...overrides
  };
}

describe("actionAuthoringRequests", () => {
  it("selects authoritative actions in server action order", () => {
    const first = testAction({ id: "action_1", name: "First Action" });
    const second = testAction({ id: "action_2", name: "Second Action" });

    expect(
      selectOrderedActionDefinitions(
        {
          action_1: first,
          action_2: second
        },
        ["action_2", "missing_action", "action_1"]
      )
    ).toEqual([second, first]);
  });

  it("builds create submissions from editor values", () => {
    const values = createEmptyActionEditorValues();
    values.name = "  Mana Burst  ";
    values.notes = "  Roll20 output only.  ";

    expect(buildCreateActionSubmission(values, "action_created")).toEqual({
      request: {
        type: "create_action",
        action: {
          id: "action_created",
          name: "Mana Burst",
          notes: "Roll20 output only.",
          steps: []
        }
      },
      label: "Create action: Mana Burst"
    });
  });

  it("does not build create or update submissions for blank action names", () => {
    const values = createEmptyActionEditorValues();
    values.name = "   ";

    expect(buildCreateActionSubmission(values, "action_created")).toBeNull();
    expect(buildUpdateActionSubmission(testAction(), values)).toBeNull();
  });

  it("builds update submissions without dropping ordered steps", () => {
    const action = testAction();
    const values = toActionEditorValues(action);
    values.name = " Edited Mana Burst ";
    values.notes = " Updated notes. ";

    expect(buildUpdateActionSubmission(action, values)).toEqual({
      request: {
        type: "update_action",
        action_id: "action_1",
        action: {
          id: "action_1",
          name: "Edited Mana Burst",
          notes: "Updated notes.",
          steps: action.steps
        }
      },
      label: "Update action: Edited Mana Burst"
    });
  });

  it("does not build update submissions without a selected action", () => {
    const values = createEmptyActionEditorValues();
    values.name = "Mana Burst";

    expect(buildUpdateActionSubmission(undefined, values)).toBeNull();
  });

  it("builds delete submissions with action labels and a missing-action fallback", () => {
    expect(buildDeleteActionSubmission("action_1", testAction())).toEqual({
      request: {
        type: "delete_action",
        action_id: "action_1"
      },
      label: "Delete action: Mana Burst"
    });

    expect(buildDeleteActionSubmission("action_missing", undefined)).toEqual({
      request: {
        type: "delete_action",
        action_id: "action_missing"
      },
      label: "Delete action: action"
    });
  });

  it("builds action/formula authoring metadata load submissions", () => {
    expect(buildLoadActionFormulaAuthoringMetadataSubmission()).toEqual({
      request: {
        type: "get_action_formula_authoring_metadata"
      },
      label: "Load action metadata"
    });
  });
});
