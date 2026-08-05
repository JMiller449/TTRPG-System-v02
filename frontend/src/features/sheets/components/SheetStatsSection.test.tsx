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
  editingKey: null,
  draftModifier: "",
  editorError: null,
  getModifier: () => 0,
  getCurrentValue: (_key: string, value: number) => value,
  onBeginEditing: () => undefined,
  onApplyModifier: () => undefined,
  onResetModifier: () => undefined,
  onDraftModifierChange: () => undefined,
  onCancelEditing: () => undefined,
  onEditorKeyDown: () => undefined
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
