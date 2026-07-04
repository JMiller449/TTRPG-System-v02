import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogTileGrid } from "@/shared/ui/CatalogTileGrid";

describe("CatalogTileGrid", () => {
  it("renders name-only selectable catalog tiles", () => {
    const markup = renderToStaticMarkup(
      <CatalogTileGrid
        items={[
          { id: "dodge", name: "Dodge" },
          { id: "block", name: "Block", disabled: true, disabledReason: "Backend-owned" }
        ]}
        selectedId="dodge"
        emptyMessage="No actions."
        onSelect={() => undefined}
      />
    );

    expect(markup).toContain(">Dodge</button>");
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('title="Backend-owned"');
    expect(markup).not.toContain("Edit");
    expect(markup).not.toContain("Delete");
  });
});
