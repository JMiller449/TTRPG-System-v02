import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CharacterSheetTabs } from "@/features/sheets/components/CharacterSheetTabs";

describe("CharacterSheetTabs", () => {
  it("exposes attributes, proficiencies, kills, and backstory as player destinations", () => {
    const markup = renderToStaticMarkup(
      <CharacterSheetTabs activeTab="attributes" onChange={() => undefined} />
    );

    expect(markup).toContain('id="sheet-tab-attributes"');
    expect(markup).toContain('id="sheet-tab-proficiencies"');
    expect(markup).toContain('id="sheet-tab-kills"');
    expect(markup).toContain('id="sheet-tab-backstory"');
    expect(markup).not.toContain('id="sheet-tab-details"');
    expect(markup).not.toContain(">Details</button>");
  });

  it("retains the GM-only history and formula destinations", () => {
    const markup = renderToStaticMarkup(
      <CharacterSheetTabs activeTab="action_history" onChange={() => undefined} mode="gm" />
    );

    expect(markup).toContain("Action History");
    expect(markup).toContain("Formula Stats");
  });
});
