import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import { ItemMakerPage } from "@/features/items/ItemMakerPage";
import { ItemTemplateBuilderPage } from "@/features/items/ItemTemplateBuilderPage";
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

describe("item template navigation", () => {
  it("keeps template management out of the item creation page", () => {
    const markup = renderPage(<ItemMakerPage client={client} />);

    expect(markup).toContain("Item / Equipment Maker");
    expect(markup).toContain("Use a Template");
    expect(markup).not.toContain("Manage Item Templates");
    expect(markup).not.toContain("New Item Template");
  });

  it("provides a dedicated item-template builder page", () => {
    const markup = renderPage(<ItemTemplateBuilderPage client={client} />);

    expect(markup).toContain("Item Template Builder");
    expect(markup).toContain("New Item Template");
    expect(markup).toContain("Item Templates");
    expect(markup).not.toContain("Player Item Approvals");
  });
});
