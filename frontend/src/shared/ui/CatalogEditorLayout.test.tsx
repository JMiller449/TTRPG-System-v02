import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogEditorLayout } from "@/shared/ui/CatalogEditorLayout";

describe("CatalogEditorLayout", () => {
  it("keeps catalog and editor content in separately labelled regions", () => {
    const markup = renderToStaticMarkup(
      <CatalogEditorLayout catalogLabel="Action Catalog" catalog={<button>Edit Dodge</button>}>
        <form aria-label="Action form">Action fields</form>
      </CatalogEditorLayout>
    );

    expect(markup).toContain('aria-label="Action Catalog"');
    expect(markup).toContain('aria-label="Action Catalog editor"');
    expect(markup).toContain("Edit Dodge");
    expect(markup).toContain("Action fields");
  });
});
