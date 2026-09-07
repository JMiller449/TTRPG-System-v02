// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  addResolveDamageActionStep,
  addSendMessageActionStep,
  addSendRollActionStep,
  createEmptyActionEditorValues
} from "@/features/actions/actionEditorValues";
import { ActionEditorForm } from "@/features/actions/components/ActionEditorForm";

function renderEditor(withSteps = false): string {
  let values = createEmptyActionEditorValues();
  if (withSteps) {
    values = addResolveDamageActionStep(addSendMessageActionStep(values, "message_1"), "damage_1");
  }
  return renderToStaticMarkup(
    <ActionEditorForm
      editingActionId={null}
      values={values}
      onChange={() => undefined}
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
}

describe("ActionEditorForm", () => {
  it("does not present a pristine draft as a failed save", () => {
    const markup = renderToStaticMarkup(
      <ActionEditorForm
        editingActionId={null}
        values={createEmptyActionEditorValues()}
        onChange={() => undefined}
        onSubmit={() => undefined}
        onCancel={() => undefined}
        metadata={null}
        proficiencies={[]}
        formulas={[]}
        standaloneEffects={[]}
        conditions={[]}
        attributesEditor={null}
        validationError="Name is required."
        validationAttempted={false}
      />
    );

    expect(markup).not.toContain("Name is required.");
    expect(markup).toContain("(required)");
    expect(markup).toContain('aria-invalid="false"');
    expect(markup).not.toContain('<button class="button" disabled="">Create Action');
  });

  it("renders one grouped Add Step control with unavailable dependency reasons", () => {
    const markup = renderEditor();

    expect(markup).toContain("Calculation &amp; Output");
    expect(markup).toContain("State Changes");
    expect(markup).toContain("Rules &amp; Effects");
    expect(markup).toContain("Add Step");
    expect(markup).not.toContain("no proficiencies authored");
    expect(markup).toContain("no effects authored");
    expect(markup).toContain("no conditions authored");
    expect(markup).not.toContain("Action Step Metadata");
    expect(markup).not.toContain("Add Calculation");
    expect(markup).not.toContain("Add Augmentation");
  });

  it("renders authored steps as compact ordered entries", () => {
    const markup = renderEditor(true);

    expect(markup).toContain("Send Roll20 message");
    expect(markup).toContain("Resolve damage");
    expect(markup).toContain("Edit");
    expect(markup).toContain("Duplicate");
    expect(markup).toContain("Remove");
    expect(markup).not.toContain("message_1");
    expect(markup).not.toContain("damage_1");
    expect(markup).not.toContain("Message Formula");
    expect(markup).not.toContain("Amount Formula");
  });

  it("keeps the final save control in a sticky footer after a long step list", () => {
    let values = createEmptyActionEditorValues();
    values.name = "Long Action";
    for (let index = 0; index < 24; index += 1) {
      values = addSendMessageActionStep(values, `long_step_${index}`);
    }
    const markup = renderToStaticMarkup(
      <ActionEditorForm
        editingActionId="long_action"
        values={values}
        onChange={() => undefined}
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

    expect(markup).toContain('class="template-editor__actions action-editor__footer"');
    expect(markup).toContain("Save Action");
    expect(markup.match(/>Edit<\/button>/g)).toHaveLength(24);
  });

  it("keeps execution visibility out of authored Roll20 message steps", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const values = addSendMessageActionStep(createEmptyActionEditorValues(), "message_1");

    await act(async () => {
      root.render(
        <ActionEditorForm
          editingActionId={null}
          values={values}
          onChange={() => undefined}
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
      await Promise.resolve();
    });

    const editButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Edit"
    );
    await act(async () => {
      editButton?.click();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("Insert Message Variable");
    expect(container.textContent).not.toContain("Earlier Calculated Value");
    expect(
      container.querySelector('textarea[placeholder="Type @ to insert a variable"]')
    ).not.toBeNull();
    expect(container.textContent).not.toContain("Roll20 Visibility");

    await act(async () => root.unmount());
  });

  it("adds action-owned proficiencies with growth enabled by default", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const values = { ...createEmptyActionEditorValues(), name: "Training Action" };
    let changedValues = values;

    await act(async () => {
      root.render(
        <ActionEditorForm
          editingActionId={null}
          values={values}
          onChange={(nextValues) => {
            changedValues = nextValues;
          }}
          onSubmit={() => undefined}
          onCancel={() => undefined}
          metadata={null}
          proficiencies={[
            { id: "longsword", name: "Longsword", description: "", default_growth_rate: 0.01 }
          ]}
          formulas={[]}
          standaloneEffects={[]}
          conditions={[]}
          attributesEditor={null}
          validationError={null}
        />
      );
      await Promise.resolve();
    });

    const proficiencyField = Array.from(container.querySelectorAll("label.field")).find((field) =>
      field.textContent?.includes("Add Proficiency")
    );
    const proficiencySelect = proficiencyField?.querySelector("select");
    expect(
      Array.from(proficiencySelect?.options ?? []).map((option) => [
        option.value,
        option.textContent
      ])
    ).toEqual([
      ["", "Choose proficiency"],
      ["longsword", "Longsword"]
    ]);

    await act(async () => {
      if (!proficiencySelect) {
        throw new Error("Expected action proficiency selector.");
      }
      proficiencySelect.value = "longsword";
      proficiencySelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(changedValues.proficiencies).toEqual([
      { proficiency_id: "longsword", gain_on_use: true }
    ]);

    await act(async () => root.unmount());
  });

  it("preserves an unchecked action proficiency growth toggle in the draft", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    let values = {
      ...createEmptyActionEditorValues(),
      name: "Careful Throw",
      proficiencies: [{ proficiency_id: "throwing", gain_on_use: true }]
    };
    const render = (): void => {
      root.render(
        <ActionEditorForm
          editingActionId="careful_throw"
          values={values}
          onChange={(nextValues) => {
            values = nextValues;
            render();
          }}
          onSubmit={() => undefined}
          onCancel={() => undefined}
          metadata={null}
          proficiencies={[
            { id: "throwing", name: "Throwing", description: "", default_growth_rate: 0.01 }
          ]}
          formulas={[]}
          standaloneEffects={[]}
          conditions={[]}
          attributesEditor={null}
          validationError={null}
        />
      );
    };

    await act(async () => {
      render();
      await Promise.resolve();
    });
    const toggle = container.querySelector<HTMLInputElement>(
      '.action-proficiency-growth-toggle input[type="checkbox"]'
    );
    expect(toggle?.checked).toBe(true);

    await act(async () => {
      toggle?.click();
      await Promise.resolve();
    });

    expect(values.proficiencies).toEqual([{ proficiency_id: "throwing", gain_on_use: false }]);
    expect(
      container.querySelector<HTMLInputElement>(
        '.action-proficiency-growth-toggle input[type="checkbox"]'
      )?.checked
    ).toBe(false);

    await act(async () => root.unmount());
  });

  it("uses one focused step view and returns to the Action overview", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const values = addResolveDamageActionStep(
      addSendMessageActionStep(createEmptyActionEditorValues(), "message_1"),
      "damage_1"
    );

    await act(async () => {
      root.render(
        <ActionEditorForm
          editingActionId={null}
          values={values}
          onChange={() => undefined}
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
      await Promise.resolve();
    });

    const editButtons = [...container.querySelectorAll("button")].filter(
      (button) => button.textContent === "Edit"
    );
    await act(async () => {
      editButtons[1]?.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Step 2: Resolve damage");
    expect(container.textContent).toContain("Back to Action");
    expect(container.querySelector(".action-editor--step-focused")).not.toBeNull();
    expect(container.textContent).toContain("Amount Formula");

    const backButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Back to Action"
    );
    await act(async () => {
      backButton?.click();
      await Promise.resolve();
    });

    expect(container.querySelector(".action-editor--step-focused")).toBeNull();
    expect(container.textContent).not.toContain("Amount Formula");

    await act(async () => root.unmount());
  });

  it("edits styled-roll results as primary and optional secondary layers", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    let values = addSendRollActionStep(createEmptyActionEditorValues(), "roll_1");

    const render = (): void => {
      root.render(
        <ActionEditorForm
          editingActionId={null}
          values={values}
          onChange={(nextValues) => {
            values = nextValues;
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

    await act(async () => {
      render();
      await Promise.resolve();
    });
    await act(async () => {
      const editStep = [...container.querySelectorAll("button")].find(
        (button) => button.textContent === "Edit"
      );
      editStep?.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Card Results");
    expect(container.textContent).toContain("Primary Result");
    expect(container.textContent).toContain("Simple cards show exactly one primary result.");
    expect(container.textContent).not.toContain("Result 1");
    expect(container.textContent).not.toContain("Formula Tags");

    await act(async () => {
      container.querySelector<HTMLButtonElement>(".action-roll-result-card button")?.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Back to Styled Roll");
    expect(container.textContent).toContain("Primary Result Label");
    expect(container.textContent).toContain("Formula Tags");

    await act(async () => {
      const backButton = [...container.querySelectorAll("button")].find(
        (button) => button.textContent === "Back to Styled Roll"
      );
      backButton?.click();
      await Promise.resolve();
    });

    const cardTypeSelect = Array.from(container.querySelectorAll("label.field"))
      .find((field) => field.textContent?.includes("Roll20 Card"))
      ?.querySelector("select");
    await act(async () => {
      if (!cardTypeSelect) {
        throw new Error("Expected the Roll20 card type selector.");
      }
      cardTypeSelect.value = "damage";
      cardTypeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Add Secondary Result");
    await act(async () => {
      const addSecondary = [...container.querySelectorAll("button")].find(
        (button) => button.textContent === "Add Secondary Result"
      );
      addSecondary?.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Secondary Result Label");
    expect(values.steps[0]).toMatchObject({ type: "send_roll", rolls: [{}, {}] });

    await act(async () => root.unmount());
  });

  it("copies a shared styled-roll formula into the action for in-place editing", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    let values = addSendRollActionStep(createEmptyActionEditorValues(), "roll_1");
    const rollStep = values.steps[0];
    if (!rollStep || rollStep.type !== "send_roll") {
      throw new Error("Expected a send-roll step.");
    }
    rollStep.rolls[0].value = {
      type: "formula_reference",
      formula_id: "weapon_attack"
    };
    const formulas = [
      {
        id: "weapon_attack",
        formula: {
          text: "floor((1 + @dagger) * (1d100 / 100) * @weapon_stat)",
          aliases: [
            {
              name: "dagger",
              path: ["action", "resolved", "proficiencies", "dagger", "modifier"]
            }
          ],
          tags: ["attack"]
        }
      }
    ];

    const render = (): void => {
      root.render(
        <ActionEditorForm
          editingActionId="weapon_attack"
          values={values}
          onChange={(nextValues) => {
            values = nextValues;
            render();
          }}
          onSubmit={() => undefined}
          onCancel={() => undefined}
          metadata={null}
          proficiencies={[]}
          formulas={formulas}
          standaloneEffects={[]}
          conditions={[]}
          attributesEditor={null}
          validationError={null}
        />
      );
    };

    await act(async () => {
      render();
      await Promise.resolve();
    });
    await act(async () => {
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Edit")
        ?.click();
      await Promise.resolve();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>(".action-roll-result-card button")?.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Shared formula");
    expect(container.textContent).toContain("weapon_attack");
    expect(container.textContent).toContain("Customize for this action");
    expect(container.textContent).not.toContain("Formula Tags");

    await act(async () => {
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Customize for this action")
        ?.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Formula Tags");
    expect(values.steps[0]).toMatchObject({
      type: "send_roll",
      rolls: [
        {
          value: {
            text: "floor((1 + @dagger) * (1d100 / 100) * @weapon_stat)",
            aliases: [
              {
                name: "dagger",
                path: ["action", "resolved", "proficiencies", "dagger", "modifier"]
              }
            ],
            tags: ["attack"]
          }
        }
      ]
    });
    expect(values.proficiencies).toEqual([{ proficiency_id: "dagger", gain_on_use: true }]);

    await act(async () => root.unmount());
  });
});
