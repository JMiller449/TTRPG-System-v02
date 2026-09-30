import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { initialState } from "@/app/state/initialState";
import { StoreContext } from "@/app/state/storeContext";
import { WeaponBuilderWizard } from "@/features/actions/components/WeaponActionWizard";
import type { GameClient } from "@/hooks/useGameClient";

describe("WeaponBuilderWizard", () => {
  it("builds a new weapon instead of selecting a saved parent item", () => {
    const client = { sendProtocolRequest: vi.fn() } as unknown as GameClient;
    const markup = renderToStaticMarkup(
      <StoreContext.Provider value={{ state: structuredClone(initialState), dispatch: vi.fn() }}>
        <WeaponBuilderWizard
          client={client}
          proficiencies={[
            {
              id: "long_swords",
              name: "Long Swords",
              description: "",
              default_growth_rate: 0.01
            }
          ]}
          intentFeedback={[]}
        />
      </StoreContext.Provider>
    );

    expect(markup).toContain("Build a Weapon");
    expect(markup).toContain("Weapon name");
    expect(markup).toContain("Create one equippable weapon");
    expect(markup).not.toContain("Parent weapon");
    expect(markup).not.toContain("Search saved weapons");
  });
});
