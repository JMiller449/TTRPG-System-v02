import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import { ItemMakerPage } from "@/features/items/ItemMakerPage";
import type { GameClient } from "@/hooks/useGameClient";

const client = {
  sendProtocolRequest: vi.fn()
} as unknown as GameClient;

function renderPage(page: JSX.Element): string {
  return renderToStaticMarkup(
    <StoreContext.Provider value={{ state: initialState, dispatch: () => undefined }}>
      {page}
    </StoreContext.Provider>
  );
}

describe("item authoring navigation", () => {
  it("opens the catalog and full editor directly without template buffers", () => {
    const markup = renderPage(<ItemMakerPage client={client} />);

    expect(markup).toContain("Catalog");
    expect(markup).toContain("authoring-workspace__editor--vertical");
    expect(markup).not.toContain("Use a Template");
    expect(markup).not.toContain("Build a Weapon");
    expect(markup).not.toContain("Manage Item Templates");
    expect(markup).not.toContain("New Item Template");
  });

  it("keeps the Item catalog editor and wizard separate", () => {
    const catalog = renderPage(
      <ItemMakerPage client={client} section="catalog" onSectionChange={vi.fn()} />
    );
    const wizard = renderPage(
      <ItemMakerPage client={client} section="wizard" onSectionChange={vi.fn()} />
    );
    expect(catalog).toContain("Catalog");
    expect(catalog).toContain("Create Item");
    expect(catalog).toContain("authoring-workspace__catalog");
    expect(catalog).toContain("authoring-workspace__editor--vertical");
    expect(catalog).not.toContain("Build a Weapon");
    expect(wizard).toContain("Wizard");
    expect(wizard).toContain("Build a Weapon");
    expect(wizard).not.toContain("Parent weapon");
  });

  it("does not expose item template authoring screens", () => {
    const catalog = renderPage(<ItemMakerPage client={client} section="catalog" />);

    expect(catalog).not.toContain("Template Catalog");
    expect(catalog).not.toContain("Template Builder");
    expect(catalog).not.toContain("Use a Template");
  });
});
