import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initialServerState } from "@/app/state/initialState";
import {
  TemplateActionsSection,
  TemplateInventorySection,
  TemplateProficienciesSection
} from "@/features/sheets/components/TemplateAssignmentsSection";
import { TemplateContextualCreateDialog } from "@/features/sheets/components/TemplateContextualCreateDialog";
import { TemplateAttributesSection } from "@/features/sheets/components/TemplateAttributesSection";
import type { TemplateContextualEntityKind } from "@/features/sheets/templateContextualAuthoring";
import { createEmptyTemplateEditorValues } from "@/features/sheets/templateEditorValues";

function renderDialog(kind: TemplateContextualEntityKind, pending = false): string {
  return renderToStaticMarkup(
    <TemplateContextualCreateDialog
      kind={kind}
      pending={pending}
      serverState={initialServerState}
      formulaMetadata={null}
      augmentationTargetMetadata={null}
      onSubmit={() => undefined}
      onClose={() => undefined}
    />
  );
}

describe("TemplateContextualCreateDialog", () => {
  it("renders compact sheet-compatible Attribute and Proficiency creation", () => {
    const attribute = renderDialog("attribute");
    expect(attribute).toContain('role="dialog"');
    expect(attribute).toContain("Create and attach Attribute");
    expect(attribute).toContain("sheet (required here)");
    expect(attribute).toContain('type="checkbox" disabled="" checked=""');

    const proficiency = renderDialog("proficiency");
    expect(proficiency).toContain("Create and attach Proficiency");
    expect(proficiency).toContain("Create Proficiency");
  });

  it("reuses the complete Item and Action editors without nested-authoring navigation", () => {
    const item = renderDialog("item");
    expect(item).toContain("Create and attach Item");
    expect(item).toContain("Quick start");
    expect(item).toContain("Create Item");
    expect(item).toContain("Equipment Effects");
    expect(item).toContain("Reference and GM notes");
    expect(item).toContain("Granted actions");
    expect(item).not.toContain("Open Action Authoring");

    const action = renderDialog("action");
    expect(action).toContain("Create and attach Action");
    expect(action).toContain("Create Action");
    expect(action).toContain("Add Step");
    expect(action).toContain("Optional values such as range or resource cost");
  });

  it("locks closure and submission controls while pending", () => {
    const pending = renderDialog("attribute", true);
    expect(pending).toContain('aria-label="Close Create and attach Attribute" disabled=""');
    expect(pending).toContain("Creating…");
  });
});

describe("Template Builder contextual controls", () => {
  it("exposes Create new controls for every assignment catalog", () => {
    const values = createEmptyTemplateEditorValues();
    const onCreateNew = () => undefined;
    const onChange = () => undefined;
    const markup = [
      renderToStaticMarkup(
        <TemplateAttributesSection
          values={values}
          definitions={{}}
          metadata={null}
          onCreateNew={onCreateNew}
          onChange={onChange}
        />
      ),
      renderToStaticMarkup(
        <TemplateActionsSection
          values={values}
          actions={{}}
          actionOrder={[]}
          onCreateNew={onCreateNew}
          onChange={onChange}
        />
      ),
      renderToStaticMarkup(
        <TemplateProficienciesSection
          values={values}
          proficiencies={{}}
          proficiencyOrder={[]}
          onCreateNew={onCreateNew}
          onChange={onChange}
        />
      ),
      renderToStaticMarkup(
        <TemplateInventorySection
          values={values}
          items={{}}
          itemOrder={[]}
          onCreateNew={onCreateNew}
          onChange={onChange}
        />
      )
    ].join("\n");

    expect(markup).toContain("Create reusable Attribute…");
    expect(markup).toContain("Create reusable Action…");
    expect(markup).toContain("Create reusable Proficiency…");
    expect(markup).toContain("Create reusable Item…");
  });
});
