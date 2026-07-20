import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SheetProficienciesSection } from "@/features/sheets/components/SheetProficienciesSection";

describe("SheetProficienciesSection", () => {
  it("shows the current capped proficiency percentage", () => {
    const markup = renderToStaticMarkup(
      <SheetProficienciesSection
        proficiencyDefinitions={{
          longsword: {
            id: "longsword",
            name: "Longsword",
            description: "",
            category: "weapon_family",
            default_growth_rate: 0.01
          }
        }}
        proficiencyOrder={["longsword"]}
        sheetProficiencies={[
          {
            relationship_id: "longsword",
            prof_id: "longsword",
            use_count: 3,
            growth_rate: 0.125
          }
        ]}
        canEdit={false}
        onCreate={() => undefined}
        onUpdate={() => undefined}
        onDelete={() => undefined}
      />
    );

    expect(markup).toContain("Proficiency 37.50%");
  });

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
