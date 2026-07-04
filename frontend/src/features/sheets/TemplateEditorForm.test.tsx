import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TemplateEditorForm } from "@/features/sheets/TemplateEditorForm";
import { createEmptyTemplateEditorValues } from "@/features/sheets/templateEditorValues";

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
  it("renders the complete tabbed workflow and control terminology", () => {
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
    expect(markup).toContain("Attributes");
    expect(markup).not.toContain(">Enemy<");
  });

  it("disables creation and shows section validation for an incomplete draft", () => {
    const markup = renderEditor();

    expect(markup).toContain("Draft needs attention");
    expect(markup).toContain("Template name is required.");
    expect(markup).toContain('type="submit" class="button" disabled=""');
  });
});
