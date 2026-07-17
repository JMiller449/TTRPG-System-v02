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

function renderEditor(valid: boolean): string {
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
      formulaMetadata={null}
      onChange={() => undefined}
      onSubmit={() => undefined}
      onCancel={() => undefined}
    />
  );
}

describe("StandaloneEffectEditorForm", () => {
  it("renders the complete action-controlled effect workflow", () => {
    const markup = renderEditor(true);
    expect(markup).toContain("Create Action-Controlled Effect");
    expect(markup).toContain("Direct instance value");
    expect(markup).toContain("Matching formula value");
    expect(markup).toContain("Matching roll mode");
    expect(markup).toContain("Same source item only");
    expect(markup).toContain("Type @ to insert a variable");
    expect(markup).not.toContain("Insert Formula Variable");
    expect(markup).toContain("Lifecycle (GM-tracked)");
    expect(markup).toContain("Expiration note");
    expect(markup).toContain("Remove when source inactive");
    expect(markup).toContain("Available to actions");
    expect(markup).not.toContain("Name is required.");
  });

  it("shows required-field errors and disables incomplete submissions", () => {
    const markup = renderEditor(false);
    expect(markup).toContain("Name is required.");
    expect(markup).toContain("Select an instance target.");
    expect(markup).toContain("Formula is required.");
    expect(markup).toContain("disabled");
  });
});
