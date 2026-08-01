import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import { createEmptyActionEditorValues } from "@/features/actions/actionEditorValues";
import { ActionAttributesEditor } from "@/features/actions/components/ActionAttributesEditor";

const metadata: ActionFormulaAuthoringMetadata = {
  variables: [],
  formula_roots: [],
  action_mutation_roots: [],
  formula_aliases: [],
  action_steps: [],
  action_preset_templates: [],
  action_attribute_presets: [
    {
      id: "spell",
      label: "Spell",
      description: "Legacy Attribute preset.",
      attribute_values: {
        action_mana_cost: { type: "number", value: 10 }
      }
    }
  ]
};

describe("ActionAttributesEditor", () => {
  it("uses the item-builder draft controls without offering Attribute presets", () => {
    const values = createEmptyActionEditorValues();
    values.attributes.action_mana_cost = {
      relationship_id: "action_attribute_mana_cost",
      attribute_id: "action_mana_cost",
      value: { type: "number", value: 5 },
      evaluated_value: null,
      evaluation_error: null
    };

    const markup = renderToStaticMarkup(
      <ActionAttributesEditor
        values={values}
        definitions={{
          action_mana_cost: {
            id: "action_mana_cost",
            name: "Mana Cost",
            subject_types: ["action"],
            value_type: "number",
            default_value: { type: "number", value: 0 },
            required: false
          },
          action_range: {
            id: "action_range",
            name: "Range",
            subject_types: ["action"],
            value_type: "number",
            default_value: { type: "number", value: 0 },
            required: false
          }
        }}
        proficiencies={{}}
        metadata={metadata}
        onChange={() => undefined}
      />
    );

    expect(markup).toContain("Attach Attribute");
    expect(markup).not.toContain("Attribute preset");
    expect(markup).not.toContain("Apply Attribute Preset");
    expect(markup).not.toContain("Save Value");
  });
});
