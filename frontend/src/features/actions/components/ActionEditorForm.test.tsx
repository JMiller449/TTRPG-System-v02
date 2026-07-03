import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
      factsEditor={null}
      validationError={null}
    />
  );
}

describe("ActionEditorForm", () => {
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
});
