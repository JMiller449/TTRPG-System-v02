import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SheetStatPointAllocator } from "@/features/sheets/components/SheetStatPointAllocator";

describe("SheetStatPointAllocator", () => {
  it("does not render when the sheet has no unassigned stat points", () => {
    const markup = renderToStaticMarkup(
      <SheetStatPointAllocator
        instanceId="hero"
        stats={{ strength: 10 }}
        unassignedPoints={0}
        onCommit={() => undefined}
      />
    );

    expect(markup).toBe("");
  });

  it("renders allocation controls for core and formula stats", () => {
    const markup = renderToStaticMarkup(
      <SheetStatPointAllocator
        instanceId="hero"
        stats={{
          strength: 10,
          dexterity: 11,
          constitution: 12,
          perception: 13,
          arcane: 14,
          will: 15,
          health: 30,
          mana: 20
        }}
        unassignedPoints={2}
        onCommit={() => undefined}
      />
    );

    expect(markup).toContain("Unassigned Stat Points");
    expect(markup).toContain("2 of 2 available");
    expect(markup).toContain("Strength");
    expect(markup).toContain("Will");
    expect(markup).toContain("Health");
    expect(markup).toContain("Mana");
    expect(markup).toContain("disabled");
  });
});
