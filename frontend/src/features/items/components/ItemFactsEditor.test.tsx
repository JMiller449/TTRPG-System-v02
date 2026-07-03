import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ItemFactsEditor } from "@/features/items/components/ItemFactsEditor";
import { createEmptyItemValues } from "@/features/items/itemEditorValues";

describe("ItemFactsEditor", () => {
  it("renders backend-declared profiles and proficiency reference choices", () => {
    const values = createEmptyItemValues();
    values.factProfile = "weapon";
    values.facts.weapon_proficiency = {
      relationship_id: "required_fact_weapon_proficiency",
      fact_id: "weapon_proficiency",
      value: { type: "reference", value: "long_swords" },
      evaluated_value: null,
      evaluation_error: null
    };

    const markup = renderToStaticMarkup(
      <ItemFactsEditor
        values={values}
        definitions={{
          weapon_proficiency: {
            id: "weapon_proficiency",
            name: "Proficiency",
            subject_types: ["item"],
            value_type: "reference",
            default_value: { type: "reference", value: "" },
            reference_kind: "proficiency",
            required: true,
            required_profile: "weapon"
          }
        }}
        proficiencies={{
          long_swords: {
            id: "long_swords",
            name: "Long Swords",
            description: ""
          }
        }}
        onChange={() => undefined}
      />
    );

    expect(markup).toContain("Fact profile");
    expect(markup).toContain('value="weapon" selected=""');
    expect(markup).toContain("Proficiency");
    expect(markup).toContain('value="long_swords" selected=""');
    expect(markup).toContain("Required");
  });
});
