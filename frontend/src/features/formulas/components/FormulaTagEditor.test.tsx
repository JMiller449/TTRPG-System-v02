// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormulaTagEditor } from "@/features/formulas/components/FormulaTagEditor";

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("FormulaTagEditor", () => {
  it("uses one inline chip-and-search control without staged add controls", () => {
    const markup = renderToStaticMarkup(
      <FormulaTagEditor tags={["damage"]} onChange={() => undefined} />
    );

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain("damage ×");
    expect(markup).toContain("Add another tag");
    expect(markup).not.toContain("Add Tags");
    expect(markup).not.toContain("Common tags");
  });

  it("filters suggestions, accepts custom tags, and removes the last chip with Backspace", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);

    function Harness(): JSX.Element {
      const [tags, setTags] = useState<string[]>([]);
      return (
        <FormulaTagEditor
          tags={tags}
          suggestions={["damage", "healing"]}
          onChange={setTags}
        />
      );
    }

    await act(async () => root.render(<Harness />));
    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    await act(async () => {
      input?.focus();
      if (input) {
        setInputValue(input, "dam");
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(document.body.textContent).toContain("damage");
    expect(document.body.textContent).not.toContain("healing");

    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(container.textContent).toContain("damage ×");
    expect(input?.value).toBe("");

    await act(async () => {
      if (input) {
        setInputValue(input, "homebrew");
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
      input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(container.textContent).toContain("homebrew ×");

    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    });
    expect(container.textContent).not.toContain("homebrew ×");
    expect(container.textContent).toContain("damage ×");

    await act(async () => root.unmount());
  });
});
