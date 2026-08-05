// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { Augmentation } from "@/domain/models";
import {
  createEmptyAugmentationEditorValues,
  type AugmentationTargetOption
} from "@/features/augmentations/augmentationEditorValues";
import { ItemAugmentationTemplatePanel } from "@/features/augmentations/components/ItemAugmentationTemplatePanel";

const target: AugmentationTargetOption = {
  key: "sheet.stats.strength",
  label: "Strength",
  root: "sheet",
  path: ["stats", "strength"],
  value_type: "number",
  description: "Base sheet stat.",
  allowed_contexts: ["item_template"]
};

const metadata: ActionFormulaAuthoringMetadata = {
  variables: [
    {
      key: "source_item.attributes.weapon_base_damage",
      label: "Source Item: Base Damage",
      root: "source_item",
      path: ["attributes", "weapon_base_damage"],
      value_type: "number",
      editable_roles: [],
      formula_backed: false,
      description: "Evaluated source item Attribute.",
      shortcuts: ["weapon_base_damage"],
      formula_reference_allowed: true,
      action_mutation_allowed: false
    }
  ],
  formula_roots: ["source_item"],
  action_mutation_roots: [],
  formula_aliases: [],
  action_steps: [],
  action_preset_templates: [],
  action_attribute_presets: []
};

const selectorOptions = { tags: [], actions: [], formulas: [], steps: [] };

describe("ItemAugmentationTemplatePanel", () => {
  it("renders attached effects as compact editable cards", () => {
    const template = {
      id: "augmentation_sharpened",
      name: "Sharpened",
      source: { type: "item", id: "never_dulls" },
      scope: "instance",
      target: { root: "sheet", path: ["stats", "strength"] },
      effect: {
        type: "formula_modifier",
        operation: "add",
        value: { aliases: null, text: "2" }
      },
      active: true
    } as Augmentation;

    const markup = renderToStaticMarkup(
      <ItemAugmentationTemplatePanel
        itemName="Never Dulls"
        editingAugmentationId={null}
        templates={[template]}
        targetOptions={[target]}
        selectorOptions={selectorOptions}
        formulaMetadata={metadata}
        values={createEmptyAugmentationEditorValues()}
        focused={false}
        onChange={() => undefined}
        onFocusedChange={() => undefined}
        onSubmit={() => undefined}
        onCancel={() => undefined}
        onEdit={() => undefined}
        onRemove={() => undefined}
      />
    );

    expect(markup).toContain("item-effect-card");
    expect(markup).toContain("1 attached");
    expect(markup).toContain("Sharpened");
    expect(markup).toContain("Wearer");
    expect(markup).toContain("Remove");
    expect(markup).not.toContain('placeholder="e.g. Arcane guard"');
  });

  it("keeps the effect editor in a focused dialog", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const values = createEmptyAugmentationEditorValues();
    values.name = "Sharpened";
    values.targetRoot = "sheet";
    values.targetPath = [...target.path];
    values.formulaText = "@weapon_base_damage";

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    function TestPanel(): JSX.Element {
      const [focused, setFocused] = useState(false);
      return (
        <ItemAugmentationTemplatePanel
          itemName="Never Dulls"
          editingAugmentationId={null}
          templates={[]}
          targetOptions={[target]}
          selectorOptions={selectorOptions}
          formulaMetadata={metadata}
          values={values}
          focused={focused}
          onChange={() => undefined}
          onFocusedChange={setFocused}
          onSubmit={() => undefined}
          onCancel={() => undefined}
          onEdit={() => undefined}
          onRemove={() => undefined}
        />
      );
    }

    await act(async () => {
      root.render(<TestPanel />);
    });

    expect(container.textContent).toContain("0 attached");
    expect(container.textContent).toContain("No equipment effects attached yet.");
    expect(container.textContent).not.toContain("Type @ to insert a variable");

    const addButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Add Effect"
    );
    await act(async () => addButton?.click());
    const focusedEditor = container.querySelector<HTMLElement>(".item-effect-panel--focused");
    const markup = focusedEditor?.innerHTML ?? "";

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(focusedEditor?.textContent).toContain("New Equipment Effect");
    expect(focusedEditor?.textContent).toContain("Active while Never Dulls is equipped");
    expect(focusedEditor?.textContent).toContain("Back to Item");
    expect(markup).toContain("Type @ to insert a variable");
    expect(markup).not.toContain("Insert Formula Variable");
    expect(markup).toContain("@weapon_base_damage");

    await act(async () => root.unmount());
    container.remove();
  });
});
