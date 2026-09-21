import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  SheetContributionPoints,
  SheetMobilitySummary,
  SheetReactionResource
} from "@/features/sheets/components/SheetRuntimeResources";

describe("SheetRuntimeResources", () => {
  it("renders the shared pool with one-click spend, restore, and reset controls", () => {
    const markup = renderToStaticMarkup(
      <SheetReactionResource
        current={1}
        maximum={2}
        canManage
        onSpend={() => undefined}
        onRestore={() => undefined}
        onReset={() => undefined}
      />
    );
    expect(markup).toContain("Action / Reaction Points");
    expect(markup).toContain('aria-label="1 of 2 available"');
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
        canManage={false}
        onSpend={() => undefined}
        onRestore={() => undefined}
        onReset={() => undefined}
      />
    );
    expect(markup).toContain('aria-label="3 of 3 available"');
    expect(markup).not.toContain(">Spend</button>");
    expect(markup).not.toContain(">Restore</button>");
    expect(markup).not.toContain(">Reset</button>");
  });

  it("shows GM discretion when Dexterity exceeds the movement table", () => {
    const markup = renderToStaticMarkup(
      <SheetMobilitySummary dodgeChance={401} movementSpeed={null} />
    );

    expect(markup).toContain("Defense &amp; Movement");
    expect(markup).toContain("Dodge = FLOOR(Dexterity × (d100 / 100))");
    expect(markup).toContain("<dd>401</dd>");
    expect(markup).toContain("greatest Dexterity threshold met");
    expect(markup).toContain("GM discretion");
  });

  it("gates contribution-point controls with management access while always showing balance", () => {
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

  it("uses compact labels for header mobility and contribution metrics", () => {
    const mobilityMarkup = renderToStaticMarkup(
      <SheetMobilitySummary compact dodgeChance={8} movementSpeed={10} />
    );
    const contributionMarkup = renderToStaticMarkup(
      <SheetContributionPoints
        compact
        value={12}
        canManage={false}
        onSet={() => undefined}
        onAdjust={() => undefined}
      />
    );

    expect(mobilityMarkup).not.toContain("Defense &amp; Movement");
    expect(mobilityMarkup).toContain("Dodge");
    expect(mobilityMarkup).toContain("Movement");
    expect(contributionMarkup).toContain(">CP</h4>");
    expect(contributionMarkup).toContain('aria-label="Contribution points: 12"');
    expect(contributionMarkup).not.toContain("Current balance");
  });
});
