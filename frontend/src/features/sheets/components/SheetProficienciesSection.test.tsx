import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SheetProficienciesSection } from "@/features/sheets/components/SheetProficienciesSection";

describe("SheetProficienciesSection", () => {
  it("leaves the visible title to its page header", () => {
    const markup = renderToStaticMarkup(
      <SheetProficienciesSection
        proficiencyDefinitions={{}}
        proficiencyOrder={[]}
        sheetProficiencies={[]}
        canEdit={false}
        onCreate={() => undefined}
        onUpdate={() => undefined}
        onDelete={() => undefined}
      />
    );

    expect(markup).toContain('aria-label="Proficiency assignments"');
    expect(markup).toContain("No proficiencies assigned yet.");
    expect(markup).not.toContain("<h4");
  });
});
