import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AttributeEditorForm } from "@/features/attributes/components/AttributeEditorForm";
import { emptyAttributeDraft } from "@/features/attributes/attributeEditorValues";

describe("AttributeEditorForm validation", () => {
  it("keeps an incomplete draft actionable and highlights it only after submission", () => {
    const pristineMarkup = renderToStaticMarkup(
      <AttributeEditorForm
        editingId={null}
        draft={emptyAttributeDraft()}
        metadata={null}
        onChange={() => undefined}
        onSubmit={() => undefined}
      />
    );
    expect(pristineMarkup).toContain("(required)");
    expect(pristineMarkup).not.toContain("Complete all required fields.");
    expect(pristineMarkup).not.toContain("disabled");

    const failedMarkup = renderToStaticMarkup(
      <AttributeEditorForm
        editingId={null}
        draft={emptyAttributeDraft()}
        metadata={null}
        validationAttempted
        onChange={() => undefined}
        onSubmit={() => undefined}
      />
    );
    expect(failedMarkup).toContain('aria-invalid="true"');
    expect(failedMarkup).toContain("Complete all required fields.");
  });
});
