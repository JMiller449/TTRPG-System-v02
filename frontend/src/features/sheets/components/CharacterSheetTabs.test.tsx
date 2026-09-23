import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CharacterSheetTabs } from "@/features/sheets/components/CharacterSheetTabs";

describe("CharacterSheetTabs", () => {
  it("exposes stats, statuses, and the existing player destinations", () => {
    const markup = renderToStaticMarkup(
      <CharacterSheetTabs activeTab="attributes" onChange={() => undefined} />
    );

    expect(markup).toContain('id="sheet-tab-attributes"');
    expect(markup).toContain('id="sheet-tab-dense"');
    expect(markup).toContain('id="sheet-tab-stats"');
    expect(markup).toContain('id="sheet-tab-statuses"');
    expect(markup).toContain('id="sheet-tab-proficiencies"');
    expect(markup).toContain('id="sheet-tab-kills"');
    expect(markup).toContain('id="sheet-tab-backstory"');
    expect(markup).not.toContain('id="sheet-tab-details"');
    expect(markup).not.toContain(">Details</button>");
    expect(markup).not.toContain('id="sheet-tab-overview"');
  });

  it("retains the GM-only history and management destinations", () => {
    const markup = renderToStaticMarkup(
      <CharacterSheetTabs activeTab="action_history" onChange={() => undefined} mode="gm" />
    );

    expect(markup).toContain("Action History");
    expect(markup).not.toContain("Formula Stats");
    expect(markup).toContain('id="sheet-tab-management"');
    expect(markup).toContain(">Management</button>");
  });

  it("keeps every shared destination identical across player and GM modes", () => {
    const playerMarkup = renderToStaticMarkup(
      <CharacterSheetTabs activeTab="stats" onChange={() => undefined} />
    );
    const gmMarkup = renderToStaticMarkup(
      <CharacterSheetTabs activeTab="stats" onChange={() => undefined} mode="gm" />
    );

    for (const tabId of [
      "stats",
      "dense",
      "statuses",
      "actions",
      "inventory",
      "resistances",
      "attributes",
      "proficiencies",
      "kills",
      "backstory",
      "notes"
    ]) {
      expect(playerMarkup).toContain(`id="sheet-tab-${tabId}"`);
      expect(gmMarkup).toContain(`id="sheet-tab-${tabId}"`);
    }
  });
});
