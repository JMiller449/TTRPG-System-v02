// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SheetFormulaStatEditorDialog } from "@/features/sheets/components/SheetFormulaStatEditorDialog";

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

describe("SheetFormulaStatEditorDialog", () => {
  it("edits only the selected formula stat without a stat selector", async () => {
    const onSave = vi.fn();
    await act(async () => {
      root.render(
        createElement(SheetFormulaStatEditorDialog, {
          statName: "lifting",
          formula: {
            aliases: [{ name: "strength", path: ["stats", "strength"] }],
            text: "@strength * 2",
            tags: ["check"]
          },
          metadata: null,
          onSave,
          onClose: () => undefined
        })
      );
    });

    expect(container.textContent).toContain("Edit Lifting");
    expect(container.querySelector("select")).toBeNull();

    const saveButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Save Formula"
    );
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSave).toHaveBeenCalledWith("lifting", {
      aliases: [{ name: "strength", path: ["stats", "strength"] }],
      text: "@strength * 2",
      tags: ["check"]
    });
  });
});
