// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  addAdjustActionPointsActionStep,
  createEmptyActionEditorValues,
  duplicateActionStep,
  getActionEditorValidationError,
  moveActionStep,
  removeActionStep,
  toActionEditorValues,
  updateAdjustActionPointsActionStep
} from "./actionEditorValues";
import { addActionStepFromMenu, buildActionStepMenuOptions } from "./actionStepMenu";
import {
  buildCreateActionSubmission,
  buildUpdateActionSubmission
} from "./actionAuthoringRequests";
import { ActionEditorForm } from "./components/ActionEditorForm";

describe("action point steps", () => {
  it("round-trips point operations through authoring requests and authoritative definitions", () => {
    const initial = { ...createEmptyActionEditorValues(), name: "Recover" };
    const added = addAdjustActionPointsActionStep(initial, "points");
    const edited = updateAdjustActionPointsActionStep(added, "points", {
      operation: "restore",
      amount: 2
    });
    expect(added.steps[0]).toMatchObject({ operation: "consume", amount: 1 });
    const submission = buildCreateActionSubmission(edited, "recover");
    if (
      submission?.request.type !== "create_action" ||
      edited.steps[0].type !== "adjust_action_points"
    ) {
      throw new Error("Expected point-step creation request.");
    }
    expect(submission.request.action.steps).toEqual(edited.steps);
    const authoritative = { id: "recover", name: "Recover", steps: [edited.steps[0]] };
    expect(toActionEditorValues(authoritative).steps).toEqual(edited.steps);
    const update = buildUpdateActionSubmission(
      authoritative,
      updateAdjustActionPointsActionStep(edited, "points", { amount: 3 })
    );
    if (update?.request.type !== "update_action") {
      throw new Error("Expected point-step update request.");
    }
    expect(update.request.action.steps?.[0]).toMatchObject({ operation: "restore", amount: 3 });
    expect(
      buildActionStepMenuOptions({}).find((entry) => entry.type === "adjust_action_points")
    ).toMatchObject({ label: "Action points", unavailableReason: null });
    expect(
      addActionStepFromMenu({
        values: initial,
        type: "adjust_action_points",
        stepId: "cost",
        dependencies: {}
      })?.steps[0]
    ).toMatchObject({ operation: "consume", amount: 1 });

    const duplicated = duplicateActionStep(edited, "points", "copy");
    const moved = moveActionStep(duplicated, "copy", "up");
    expect(moved.steps.map((step) => step.step_id)).toEqual(["copy", "points"]);
    expect(removeActionStep(moved, "points").steps).toEqual([
      { ...edited.steps[0], step_id: "copy" }
    ]);
  });

  it.each([0, -1, 0.5, NaN, Infinity])("prevents saving an invalid point amount: %s", (amount) => {
    const values = updateAdjustActionPointsActionStep(
      addAdjustActionPointsActionStep({ ...createEmptyActionEditorValues(), name: "Cost" }, "cost"),
      "cost",
      { amount }
    );
    expect(getActionEditorValidationError(values)).toBe(
      "Action point amount must be a positive whole number."
    );
    expect(buildCreateActionSubmission(values, "cost")).toBeNull();
  });

  it("adds and edits a point step in the full action editor and retains it on returning", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    let values = { ...createEmptyActionEditorValues(), name: "Second Wind" };
    const render = (): void => {
      root.render(
        <ActionEditorForm
          editingActionId={null}
          values={values}
          onChange={(next) => {
            values = next;
            render();
          }}
          onSubmit={() => undefined}
          onCancel={() => undefined}
          metadata={null}
          proficiencies={[]}
          formulas={[]}
          standaloneEffects={[]}
          conditions={[]}
          attributesEditor={null}
          validationError={null}
        />
      );
    };
    try {
      await act(async () => render());
      const menu = [...container.querySelectorAll("select")].find((select) =>
        [...select.options].some((option) => option.value === "adjust_action_points")
      );
      expect(menu).toBeDefined();
      await act(async () => {
        menu!.value = "adjust_action_points";
        menu!.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await act(async () => {
        [...container.querySelectorAll("button")]
          .find((button) => button.textContent === "Add Step")!
          .click();
      });
      expect(values.steps[0]).toMatchObject({ operation: "consume", amount: 1 });
      const operation = [...container.querySelectorAll("select")].find((select) =>
        [...select.options].some((option) => option.value === "restore")
      );
      expect(operation).toBeDefined();
      await act(async () => {
        operation!.value = "restore";
        operation!.dispatchEvent(new Event("change", { bubbles: true }));
      });
      const amount = container.querySelector<HTMLInputElement>('input[type="number"]');
      expect(amount).not.toBeNull();
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
          amount,
          "2"
        );
        amount!.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(values.steps[0]).toMatchObject({ operation: "restore", amount: 2 });
      expect(container.textContent).toContain("shared Action / Reaction Points pool");
      await act(async () => {
        [...container.querySelectorAll("button")]
          .find((button) => button.textContent?.includes("Back to Action"))!
          .click();
      });
      expect(container.textContent).toContain("Restore 2 action points");
      expect(container.querySelector('input[type="number"]')).toBeNull();
    } finally {
      await act(async () => root.unmount());
    }
  });
});
