import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
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
      key: "source_item.facts.weapon_base_damage",
      label: "Source Item: Base Damage",
      root: "source_item",
      path: ["facts", "weapon_base_damage"],
      value_type: "number",
      editable_roles: [],
      formula_backed: false,
      description: "Evaluated source item Fact.",
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
  action_fact_presets: []
};

const selectorOptions = { tags: [], actions: [], formulas: [], steps: [] };

describe("ItemAugmentationTemplatePanel", () => {
  it("renders formula variable insertion for equipment effects", () => {
    const values = createEmptyAugmentationEditorValues();
    values.name = "Sharpened";
    values.targetRoot = "sheet";
    values.targetPath = [...target.path];
    values.formulaText = "@weapon_base_damage";

    const markup = renderToStaticMarkup(
      <ItemAugmentationTemplatePanel
        itemName="Never Dulls"
        editingAugmentationId={null}
        templates={[]}
        targetOptions={[target]}
        selectorOptions={selectorOptions}
        formulaMetadata={metadata}
        values={values}
        onChange={() => undefined}
        onSubmit={() => undefined}
        onCancel={() => undefined}
        onEdit={() => undefined}
        onRemove={() => undefined}
      />
    );

    expect(markup).toContain("Equipment Effects");
    expect(markup).toContain("Insert Formula Variable");
    expect(markup).toContain("@weapon_base_damage");
  });
});
