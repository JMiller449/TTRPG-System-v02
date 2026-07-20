import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ItemDefinition } from "@/domain/models";
import { ItemCatalogBrowser } from "@/features/items/components/ItemCatalogBrowser";

function item(id: string, name: string, catalogFolder = ""): ItemDefinition {
  return {
    id,
    name,
    interaction_type: "inventory_only",
    catalog_folder: catalogFolder,
    description: "",
    price: "",
    weight: 0
  };
}

describe("ItemCatalogBrowser", () => {
  it("renders folder navigation, counts, search, and the selected item tile", () => {
    const markup = renderToStaticMarkup(
      <ItemCatalogBrowser
        items={[item("sword", "Sun Blade", "Weapons"), item("coin", "Old Coin")]}
        selectedId="sword"
        onSelect={() => undefined}
      />
    );

    expect(markup).toContain('aria-label="Item catalog folders"');
    expect(markup).toContain("Search items");
    expect(markup).toContain("Weapons");
    expect(markup).toContain("Unfiled");
    expect(markup).toContain(">Sun Blade</button>");
    expect(markup).toContain('aria-pressed="true"');
  });
});
