import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TemplateEditorForm } from "@/features/sheets/TemplateEditorForm";
import { TemplateReviewSection } from "@/features/sheets/components/TemplateReviewSection";
import {
  createEmptyTemplateEditorValues,
  validateTemplateEditorValues
} from "@/features/sheets/templateEditorValues";

function renderEditor(name = ""): string {
  const values = createEmptyTemplateEditorValues("enemy");
  values.name = name;
  return renderToStaticMarkup(
    <TemplateEditorForm
      title="New Template"
      submitLabel="Create Template"
      values={values}
      actions={{}}
      actionOrder={[]}
      proficiencies={{}}
      proficiencyOrder={[]}
      items={{}}
      itemOrder={[]}
      attributes={{}}
      metadata={null}
      onChange={() => undefined}
      onSubmit={() => undefined}
    />
  );
}

describe("TemplateEditorForm", () => {
  it("renders a novice-first workflow with required, optional, advanced, and review steps", () => {
    const markup = renderEditor("Orc Brute");

    expect(markup).toContain("Player-controlled");
    expect(markup).toContain("GM-controlled");
    expect(markup).toContain("Details");
    expect(markup).toContain("Stats");
    expect(markup).toContain("Attributes");
    expect(markup).toContain("Resistances");
    expect(markup).toContain("Actions");
    expect(markup).toContain("Proficiencies");
    expect(markup).toContain("Inventory");
    expect(markup).toContain("Core setup");
    expect(markup).toContain("Starting content");
    expect(markup).toContain("Advanced");
    expect(markup).toContain("Required");
    expect(markup).toContain("Optional");
    expect(markup).toContain("Review Template");
    expect(markup).not.toContain(">Enemy<");
  });

  it("does not confront a new draft with validation before review", () => {
    const markup = renderEditor();

    expect(markup).toContain("Draft in progress");
    expect(markup).not.toContain("Template name is required.");
    expect(markup).not.toContain("issue to resolve");
    expect(markup).toContain("Only Details is required");
  });

  it("makes review errors actionable after the user requests a final check", () => {
    const values = createEmptyTemplateEditorValues("enemy");
    const validation = validateTemplateEditorValues(values, {
      actions: {},
      proficiencies: {},
      items: {},
      attributes: {}
    });
    const markup = renderToStaticMarkup(
      <TemplateReviewSection
        values={values}
        validation={validation}
        onNavigate={() => undefined}
      />
    );

    expect(markup).toContain("Template name is required.");
    expect(markup).toContain(">Details</button>");
    expect(markup).toContain("Empty optional sections are valid");
  });
});
