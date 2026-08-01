import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProficiencyEditorForm } from "@/features/proficiencies/components/ProficiencyEditorForm";
import { createEmptyProficiencyEditorValues } from "@/features/proficiencies/proficiencyEditorValues";

function renderEditor(validationAttempted: boolean): string {
  return renderToStaticMarkup(
    <ProficiencyEditorForm
      editingProficiencyId={null}
      values={createEmptyProficiencyEditorValues()}
      validationAttempted={validationAttempted}
      onChange={() => undefined}
      onSubmit={() => undefined}
      onCancel={() => undefined}
    />
  );
}

describe("ProficiencyEditorForm validation", () => {
  it("defers invalid styling until submission while keeping create actionable", () => {
    const pristineMarkup = renderEditor(false);
    expect(pristineMarkup).toContain("(required)");
    expect(pristineMarkup).toContain('aria-invalid="false"');
    expect(pristineMarkup).not.toContain("Complete all required fields.");

    const failedMarkup = renderEditor(true);
    expect(failedMarkup).toContain('aria-invalid="true"');
    expect(failedMarkup).toContain("Complete all required fields.");
    expect(failedMarkup).not.toContain('<button class="button" disabled="">');
  });
});
