// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SheetStatsSection } from "@/features/sheets/components/SheetStatsSection";

let container: HTMLDivElement;
let root: Root;

const baseProps = {
  compact: false,
  stats: { strength: 11, lifting: 22 },
  formulaStats: {
    lifting: {
      aliases: [{ name: "strength", path: ["stats", "strength"] }],
      text: "@strength * 2",
      tags: []
    }
  },
  onAddCoreStatPoints: () => undefined
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("SheetStatsSection formula interaction", () => {
  it("opens point granting from a GM major-stat click", async () => {
    const onAddCoreStatPoints = vi.fn();
    await act(async () => {
      root.render(
        createElement(SheetStatsSection, {
          ...baseProps,
          canEditStats: true,
          onAddCoreStatPoints
        })
      );
    });
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>(
          '[aria-label="Add points to Strength. Current value 11."]'
        )
        ?.click()
    );
    expect(onAddCoreStatPoints).toHaveBeenCalledWith("strength");
    expect(container.querySelector('[aria-label^="Edit Strength"]')).toBeNull();
  });

  it("explains major-stat assignment origins and active augmentations", async () => {
    await act(async () => {
      root.render(
        createElement(SheetStatsSection, {
          ...baseProps,
          canEditStats: false,
          instanceId: "hero",
          statPointSummary: {
            allocated: { strength: 10 },
            assignment_origins: { strength: { starter: 8, user: 1, dm: 1 } }
          },
          augmentations: {
            gauntlets: {
              id: "gauntlets",
              name: "Iron Gauntlets",
              source: { type: "item", label: "Iron Gauntlets" },
              scope: "instance",
              target: { root: "instance", path: ["stats", "strength"] },
              effect: {
                type: "formula_modifier",
                operation: "add",
                value: { text: "1", aliases: null, tags: [] }
              },
              applied: true,
              applied_target_id: "hero"
            }
          }
        })
      );
    });

    expect(container.textContent).toContain("Effective: 11");
    expect(container.textContent).toContain("Base total: 10");
    expect(container.textContent).toContain("Starter: 8");
    expect(container.textContent).toContain("User assigned: 1");
    expect(container.textContent).toContain("DM assigned: 1");
    expect(container.textContent).toContain("Iron Gauntlets: Add 1 to the target value");
  });

  it("explains a derived formula and lets a GM edit that exact substat", async () => {
    const onEditFormulaStat = vi.fn();
    await act(async () => {
      root.render(
        createElement(SheetStatsSection, {
          ...baseProps,
          canEditStats: true,
          onEditFormulaStat
        })
      );
    });

    expect(container.textContent).toContain("Formula: @strength * 2");
    expect(container.textContent).toContain("@strength → stats.strength");

    const liftingButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Edit Lifting formula. Current value 22."]'
    );
    await act(async () => {
      liftingButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onEditFormulaStat).toHaveBeenCalledWith("lifting");
  });

  it("keeps the formula explanation read-only for players", async () => {
    await act(async () => {
      root.render(createElement(SheetStatsSection, { ...baseProps, canEditStats: false }));
    });

    expect(container.textContent).toContain("Formula: @strength * 2");
    expect(container.querySelector('[aria-label^="Edit Lifting formula"]')).toBeNull();
  });
});
