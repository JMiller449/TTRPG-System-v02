import { describe, expect, it } from "vitest";
import type { ActionDefinition } from "@/domain/models";
import { actionNeedsPointRefill } from "@/features/actions/actionPointRecovery";

function actionWithSteps(steps: ActionDefinition["steps"]): ActionDefinition {
  return { id: "test-action", name: "Test Action", steps };
}

describe("actionNeedsPointRefill", () => {
  it("detects a point-consuming action when the character is empty", () => {
    const action = actionWithSteps([
      { step_id: "cost", type: "adjust_action_points", operation: "consume", amount: 1 }
    ]);

    expect(actionNeedsPointRefill(action, 0, 3)).toBe(true);
    expect(actionNeedsPointRefill(action, 1, 3)).toBe(false);
  });

  it("does not interrupt actions that do not consume points", () => {
    const action = actionWithSteps([]);

    expect(actionNeedsPointRefill(action, 0, 3)).toBe(false);
  });

  it("respects point restoration earlier in the action", () => {
    const action = actionWithSteps([
      { step_id: "restore", type: "adjust_action_points", operation: "restore", amount: 1 },
      { step_id: "cost", type: "adjust_action_points", operation: "consume", amount: 1 }
    ]);

    expect(actionNeedsPointRefill(action, 0, 3)).toBe(false);
  });

  it("does not offer a refill when even the full pool cannot pay the cost", () => {
    const action = actionWithSteps([
      { step_id: "cost", type: "adjust_action_points", operation: "consume", amount: 4 }
    ]);

    expect(actionNeedsPointRefill(action, 0, 3)).toBe(false);
  });
});
