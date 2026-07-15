// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SheetResourceHeader } from "@/features/sheets/components/SheetResourceHeader";

let container: HTMLDivElement;
let root: Root;

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

describe("SheetResourceHeader", () => {
  it("uses each complete resource summary as its editor trigger", async () => {
    const onBeginResourceEdit = vi.fn();

    await act(async () => {
      root.render(
        createElement(SheetResourceHeader, {
          maximums: { health: 120, mana: 1568 },
          resources: { health: 90, mana: 30 },
          editingResource: null,
          resourceDraftModifier: "",
          healthDamageType: "",
          resourceEditorError: null,
          onBeginResourceEdit,
          onResourceDraftModifierChange: () => undefined,
          onHealthDamageTypeChange: () => undefined,
          onApplyResourceModifier: () => undefined,
          onCancelResourceEdit: () => undefined,
          onResourceEditorKeyDown: () => undefined
        })
      );
    });

    const healthCard = container.querySelector(".resource-card--health");
    const healthTrigger = healthCard?.querySelector<HTMLButtonElement>(".resource-card__trigger");

    expect(healthTrigger?.textContent).toContain("Health");
    expect(healthTrigger?.textContent).toContain("90/120");
    expect(healthTrigger?.querySelector(".resource-card__meter")).not.toBeNull();
    expect(container.querySelectorAll(".resource-card__trigger")).toHaveLength(2);

    await act(async () => healthCard?.querySelector<HTMLElement>(".resource-card__label")?.click());

    expect(onBeginResourceEdit).toHaveBeenCalledWith("health");
  });

  it("dismisses an open editor on click-away without rendering a Cancel button", async () => {
    const onCancelResourceEdit = vi.fn();

    await act(async () => {
      root.render(
        createElement(SheetResourceHeader, {
          maximums: { health: 120, mana: 1568 },
          resources: { health: 90, mana: 30 },
          editingResource: "health",
          resourceDraftModifier: "",
          healthDamageType: "",
          resourceEditorError: null,
          onBeginResourceEdit: () => undefined,
          onResourceDraftModifierChange: () => undefined,
          onHealthDamageTypeChange: () => undefined,
          onApplyResourceModifier: () => undefined,
          onCancelResourceEdit,
          onResourceEditorKeyDown: () => undefined
        })
      );
    });

    expect(container.textContent).not.toContain("Cancel");

    await act(async () => {
      container
        .querySelector("#resource-editor-health")
        ?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(onCancelResourceEdit).not.toHaveBeenCalled();

    await act(async () => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(onCancelResourceEdit).toHaveBeenCalledOnce();
  });
});
