// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  addResolveDamageActionStep,
  addSendMessageActionStep,
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
        showValidationError={false}
      />
    );

    expect(markup).not.toContain("Name is required.");
    expect(markup).toContain("disabled");
  });

  it("renders one grouped Add Step control with unavailable dependency reasons", () => {
    const markup = renderEditor();

    expect(markup).toContain("Calculation &amp; Output");
    expect(markup).toContain("State Changes");
    expect(markup).toContain("Rules &amp; Effects");
    expect(markup).toContain("Add Step");
    expect(markup).toContain("no proficiencies authored");
    expect(markup).toContain("no standalone effects authored");
    expect(markup).toContain("no conditions authored");
    expect(markup).not.toContain("Action Step Metadata");
    expect(markup).not.toContain("Add Calculation");
    expect(markup).not.toContain("Add Augmentation");
  });

  it("renders authored steps as compact ordered entries", () => {
    const markup = renderEditor(true);

    expect(markup).toContain("Send Roll20 message");
    expect(markup).toContain("message_1");
    expect(markup).toContain("Resolve damage");
    expect(markup).toContain("damage_1");
    expect(markup).toContain("Duplicate");
    expect(markup).toContain("Remove");
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

    expect(markup).toContain("long_step_23");
    expect(markup).toContain('class="template-editor__actions action-editor__footer"');
    expect(markup).toContain("Save Action");
    expect(markup.indexOf("Save Action")).toBeGreaterThan(markup.indexOf("long_step_23"));
  });

  it("offers Public and GM visibility for Roll20 messages", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const onChange = vi.fn();
    const values = addSendMessageActionStep(createEmptyActionEditorValues(), "message_1");

    await act(async () => {
      root.render(
        <ActionEditorForm
          editingActionId={null}
          values={values}
          onChange={onChange}
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

    const visibilityField = [...container.querySelectorAll("label")].find((label) =>
      label.textContent?.includes("Roll20 Visibility")
    );
    const visibilitySelect = visibilityField?.querySelector("select");
    expect(container.textContent).not.toContain("Insert Message Variable");
    expect(container.textContent).not.toContain("Earlier Calculated Value");
    expect(container.querySelector('textarea[placeholder="Type @ to insert a variable"]')).not.toBeNull();
    expect(visibilitySelect?.value).toBe("public");
    expect(
      [...(visibilitySelect?.querySelectorAll("option") ?? [])].map((option) => option.textContent)
    ).toEqual(["Public", "GM"]);

    await act(async () => {
      if (visibilitySelect) {
        visibilitySelect.value = "gm";
        visibilitySelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: [expect.objectContaining({ visibility: "gm" })]
      })
    );

    await act(async () => root.unmount());
  });
});
