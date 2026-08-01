import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import { ItemEditorForm } from "@/features/items/components/ItemEditorForm";
import { createEmptyItemValues } from "@/features/items/itemEditorValues";

function renderEditor(validationAttempted: boolean): string {
  return renderToStaticMarkup(
    <StoreContext.Provider value={{ state: structuredClone(initialState), dispatch: vi.fn() }}>
      <ItemEditorForm
        editingItemId={null}
        values={createEmptyItemValues()}
        validationAttempted={validationAttempted}
        onChange={() => undefined}
        actions={[]}
        attributeDefinitions={{}}
        proficiencies={{}}
        tagDefinitions={{}}
        attributesEditor={null}
        effectEditor={null}
        onSubmit={() => undefined}
        onCancel={() => undefined}
      />
    </StoreContext.Provider>
  );
}

describe("ItemEditorForm validation", () => {
  it("defers required-field errors until an attempted create", () => {
    const pristineMarkup = renderEditor(false);
    expect(pristineMarkup).toContain("(required)");
    expect(pristineMarkup).not.toContain("Complete all required fields.");

    const failedMarkup = renderEditor(true);
    expect(failedMarkup).toContain('aria-invalid="true"');
    expect(failedMarkup).toContain("Complete all required fields.");
    expect(failedMarkup).not.toContain('<button class="button" disabled="">Create Item');
  });
});
