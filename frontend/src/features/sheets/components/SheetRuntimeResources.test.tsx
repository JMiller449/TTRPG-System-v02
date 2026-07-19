import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  SheetContributionPoints,
  SheetReactionResource
} from "@/features/sheets/components/SheetRuntimeResources";

describe("SheetRuntimeResources", () => {
  it("renders fractional reactions without truncating them", () => {
    const markup = renderToStaticMarkup(
      <SheetReactionResource
        current={0.5}
        maximum={1.5}
        onAdjust={() => undefined}
        onReset={() => undefined}
      />
    );
    expect(markup).toContain("0.5 / 1.5 available");
    expect(markup).toContain(">Spend</button>");
    expect(markup).toContain(">Restore</button>");
    expect(markup).toContain(">Reset</button>");
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
    expect(gmMarkup).toContain(">Add</button>");
    expect(gmMarkup).toContain(">Subtract</button>");
    expect(gmMarkup).toContain(">Set</button>");
  });
});
