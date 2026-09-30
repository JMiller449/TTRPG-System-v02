import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyAugmentationEditorValues } from "@/features/augmentations/augmentationEditorValues";
import { StandaloneEffectEditorForm } from "@/features/effects/components/StandaloneEffectEditorForm";

const target = {
  key: "current_health",
  label: "Current Health",
  root: "instance" as const,
  path: ["resources", "health"],
  value_type: "resource" as const,
  description: "Current health value.",
  allowed_contexts: ["runtime" as const]
};
const selectorOptions = { tags: [], actions: [], formulas: [], steps: [] };

function renderEditor(valid: boolean, validationAttempted = false): string {
  const values = createEmptyAugmentationEditorValues();
  if (valid) {
    values.name = "Focused";
    values.targetPath = [...target.path];
    values.effectType = "evaluation_formula_modifier";
    values.formulaText = "2";
  }
  return renderToStaticMarkup(
    <StandaloneEffectEditorForm
      editingEffectId={null}
      values={values}
      targetOptions={[target]}
      selectorOptions={selectorOptions}
      formulas={[]}
      formulaMetadata={null}
      validationAttempted={validationAttempted}
      onChange={() => undefined}
      onSubmit={() => undefined}
      onCancel={() => undefined}
    />
  );
}

describe("StandaloneEffectEditorForm", () => {
  it("renders the adaptive effect workflow with readable progressive sections", () => {
    const markup = renderEditor(true);
    expect(markup).toContain("Create Effect");
    expect(markup).toContain("Change a character value");
    expect(markup).toContain("Modify rolls or calculations");
    expect(markup).toContain("Modify proficiency growth");
    expect(markup).toContain("Grant advantage or disadvantage");
    expect(markup).not.toContain("Current effect");
    expect(markup).not.toContain("Character value");
    expect(markup).not.toContain("Context Value");
    expect(markup).toContain("Value or formula");
    expect(markup).toContain("insert an authoritative character value");
    expect(markup).toContain("Advanced matching");
    expect(markup).toContain("Same source item only");
    expect(markup).toContain("Notes and availability");
    expect(markup).toContain("Lifecycle");
    expect(markup).toContain("Stacking");
    expect(markup).toContain("Expiration note");
    expect(markup).toContain("Remove when its source becomes inactive");
    expect(markup).toContain("Effect enabled");
  });

  it("highlights required fields only after an incomplete submission attempt", () => {
    const pristineMarkup = renderEditor(false);
    expect(pristineMarkup).not.toContain("Complete the highlighted effect fields.");
    expect(pristineMarkup).toContain('aria-invalid="false"');

    const failedMarkup = renderEditor(false, true);
    expect(failedMarkup).toContain("Complete the highlighted effect fields.");
    expect(failedMarkup).toContain('aria-invalid="true"');
    expect(failedMarkup).not.toContain("disabled");
  });
});
