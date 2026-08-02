import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  SheetContributionPoints,
  SheetReactionResource
} from "@/features/sheets/components/SheetRuntimeResources";

describe("SheetRuntimeResources", () => {
  it("renders the shared pool with one-click spend, restore, and reset controls", () => {
    const markup = renderToStaticMarkup(
      <SheetReactionResource
        current={1}
        maximum={2}
        dodgeChance={26}
        canManage
        onSpend={() => undefined}
        onRestore={() => undefined}
        onReset={() => undefined}
      />
    );
    expect(markup).toContain("Action / Reaction Points");
    expect(markup).toContain("1 / 2 available");
    expect(markup).toContain("Dodge Chance");
    expect(markup).toContain("Dodge = FLOOR(Dexterity × (d100 / 100))");
    expect(markup).toContain("<strong>26</strong>");
    expect(markup).toContain(">Spend</button>");
    expect(markup).toContain(">Restore</button>");
    expect(markup).toContain(">Reset</button>");
    expect(markup).not.toContain('type="number"');
  });

  it("disables controls at authoritative pool boundaries", () => {
    const emptyMarkup = renderToStaticMarkup(
      <SheetReactionResource
        current={0}
        maximum={2}
        dodgeChance={26}
        canManage
        onSpend={() => undefined}
        onRestore={() => undefined}
        onReset={() => undefined}
      />
    );
    const fullMarkup = renderToStaticMarkup(
      <SheetReactionResource
        current={2}
        maximum={2}
        dodgeChance={26}
        canManage
        onSpend={() => undefined}
        onRestore={() => undefined}
        onReset={() => undefined}
      />
    );

    expect(emptyMarkup).toContain('disabled="">Spend</button>');
    expect(emptyMarkup).toContain(">Restore</button>");
    expect(fullMarkup).toContain('disabled="">Restore</button>');
    expect(fullMarkup).toContain('disabled="">Reset</button>');
  });

  it("keeps the shared tally visible while hiding controls from read-only viewers", () => {
    const markup = renderToStaticMarkup(
      <SheetReactionResource
        current={3}
        maximum={3}
        dodgeChance={26}
        canManage={false}
        onSpend={() => undefined}
        onRestore={() => undefined}
        onReset={() => undefined}
      />
    );
    expect(markup).toContain("3 / 3 available");
    expect(markup).not.toContain(">Spend</button>");
    expect(markup).not.toContain(">Restore</button>");
    expect(markup).not.toContain(">Reset</button>");
  });

  it("keeps contribution-point controls GM-only while always showing balance", () => {
    const playerMarkup = renderToStaticMarkup(
      <SheetContributionPoints
        value={12}
        canManage={false}
        onSet={() => undefined}
        onAdjust={() => undefined}
      />
    );
    const gmMarkup = renderToStaticMarkup(
      <SheetContributionPoints
        value={12}
        canManage
        onSet={() => undefined}
        onAdjust={() => undefined}
      />
    );
    expect(playerMarkup).toContain("Current balance: <strong>12</strong>");
    expect(playerMarkup).not.toContain(">Add</button>");
    expect(playerMarkup).not.toContain("<details");
    expect(gmMarkup).toContain("<details");
    expect(gmMarkup).toContain("<summary");
    expect(gmMarkup).toContain(">Add</button>");
    expect(gmMarkup).toContain(">Subtract</button>");
    expect(gmMarkup).toContain(">Set</button>");
  });
});
