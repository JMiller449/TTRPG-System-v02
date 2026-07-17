// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import { FormulaEditorForm } from "@/features/formulas/components/FormulaEditorForm";
import {
  createEmptyFormulaEditorValues,
  type FormulaEditorValues
} from "@/features/formulas/formulaEditorValues";

const metadata = {
  variables: [
    {
      key: "sheet.stats.mana",
      label: "Mana",
      root: "sheet",
      path: ["stats", "mana"],
      value_type: "number",
      description: "Mana stat.",
      shortcuts: ["mana"],
      formula_reference_allowed: true,
      action_mutation_allowed: true
    }
  ]
} as unknown as ActionFormulaAuthoringMetadata;

describe("FormulaEditorForm", () => {
  it("inserts @ variables in place and stores their aliases", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);

    function Harness(): JSX.Element {
      const [values, setValues] = useState<FormulaEditorValues>(createEmptyFormulaEditorValues);
      return (
        <FormulaEditorForm
          editingFormulaId={null}
          values={values}
          onChange={setValues}
          onSubmit={() => undefined}
          onCancel={() => undefined}
          metadata={metadata}
        />
      );
    }

    await act(async () => root.render(<Harness />));
    const textarea = container.querySelector("textarea");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      setter?.call(textarea, "Total: @ma + 2");
      textarea?.setSelectionRange(10, 10);
      textarea?.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    await act(async () => {
      textarea?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(textarea?.value).toBe("Total: @mana + 2");
    expect(container.textContent).toContain("mana: sheet.stats.mana");
    await act(async () => root.unmount());
  });
});
