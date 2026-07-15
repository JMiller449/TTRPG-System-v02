// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SheetNotesSection } from "@/features/sheets/components/SheetNotesSection";

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

describe("SheetNotesSection", () => {
  it("separates save status from the writing controls", async () => {
    const onSave = vi.fn();

    await act(async () => {
      root.render(
        createElement(SheetNotesSection, {
          sheetId: "mage",
          note: "Existing note",
          onSave
        })
      );
    });

    const editor = container.querySelector<HTMLTextAreaElement>(".sheet-notes-section__editor");
    const status = container.querySelector(".sheet-notes-section__status");
    const actions = container.querySelector(".sheet-notes-section__actions");

    expect(editor?.rows).toBe(12);
    expect(status?.textContent).toBe("All changes saved");
    expect(actions?.contains(status)).toBe(false);
    expect(actions?.querySelectorAll("button")).toHaveLength(2);

    await act(async () => {
      if (!editor) return;
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      valueSetter?.call(editor, "Updated note");
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.querySelector(".sheet-notes-section__status")?.textContent).toBe(
      "Unsaved changes"
    );
    expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(false);
  });
});
