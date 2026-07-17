// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import {
  FormulaVariableInput
} from "@/features/variables/components/FormulaVariableInput";
import {
  activeFormulaMention,
  replaceFormulaMention
} from "@/features/variables/formulaVariableMention";

const options = [
  {
    id: "sheet.stats.mana",
    label: "Mana",
    secondary: "@mana | sheet.stats.mana",
    keywords: ["mana", "sheet.stats.mana"],
    value: { token: "@mana", alias: { name: "mana", path: ["sheet", "stats", "mana"] } }
  },
  {
    id: "sheet.stats.arcane",
    label: "Arcane",
    secondary: "@arc | sheet.stats.arcane",
    keywords: ["arcane", "sheet.stats.arcane"],
    value: { token: "@arc", alias: { name: "arc", path: ["sheet", "stats", "arcane"] } }
  }
];

describe("FormulaVariableInput", () => {
  it("finds and replaces only the active @ mention at the cursor", () => {
    expect(activeFormulaMention("Mana is @ma", 11)).toEqual({
      start: 8,
      end: 11,
      query: "ma"
    });
    expect(activeFormulaMention("email@example.com", 17)).toBeNull();
    expect(activeFormulaMention("@mana + 2", 3)).toEqual({
      start: 0,
      end: 5,
      query: "mana"
    });
    expect(replaceFormulaMention("@arc + @ma + 2", { start: 7, end: 10 }, "@mana")).toEqual({
      text: "@arc + @mana + 2",
      cursor: 12
    });
  });

  it("opens on @, filters, and inserts with the keyboard", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const onVariableSelect = vi.fn();

    function Harness(): JSX.Element {
      const [value, setValue] = useState("");
      return (
        <FormulaVariableInput
          label="Formula"
          value={value}
          options={options}
          onChange={setValue}
          onVariableSelect={(entry, nextText) => {
            onVariableSelect(entry, nextText);
            setValue(nextText);
          }}
        />
      );
    }

    await act(async () => root.render(<Harness />));
    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      setter?.call(textarea, "@ma");
      textarea?.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(document.body.textContent).toContain("Mana");
    expect(document.body.textContent).not.toContain("Arcane");
    await act(async () => {
      textarea?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(onVariableSelect).toHaveBeenCalledWith(options[0]?.value, "@mana");
    expect(textarea?.value).toBe("@mana");
    await act(async () => root.unmount());
  });
});
