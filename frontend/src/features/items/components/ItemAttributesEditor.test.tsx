import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ItemAttributesEditor } from "@/features/items/components/ItemAttributesEditor";
import { selectAuthoritativeProficiencies } from "@/features/items/proficiencyOptions";
import { createEmptyItemValues } from "@/features/items/itemEditorValues";

describe("ItemAttributesEditor", () => {
  it("renders attached Attributes and proficiency reference choices", () => {
    const values = createEmptyItemValues();
    values.attributes.weapon_proficiency = {
      relationship_id: "required_attribute_weapon_proficiency",
      attribute_id: "weapon_proficiency",
      value: { type: "reference", value: "long_swords" },
      evaluated_value: null,
      evaluation_error: null
    };

    const markup = renderToStaticMarkup(
      <ItemAttributesEditor
        values={values}
        definitions={{
          weapon_proficiency: {
            id: "weapon_proficiency",
            name: "Proficiency",
            subject_types: ["item"],
            value_type: "reference",
            default_value: { type: "reference", value: "" },
            reference_kind: "proficiency",
            required: false
          }
        }}
        proficiencies={{
          long_swords: {
            id: "long_swords",
            name: "Long Swords",
            description: "",
            default_growth_rate: 0.01
          }
        }}
        metadata={null}
        onChange={() => undefined}
      />
    );

    expect(markup).toContain("Attach named values");
    expect(markup).toContain("Proficiency");
    expect(markup).toContain('placeholder="Search proficiency catalog"');
    expect(markup).toContain('value="Long Swords"');
  });

  it("does not offer missing proficiency references as selectable choices", () => {
    const values = createEmptyItemValues();
    values.attributes.weapon_proficiency = {
      relationship_id: "required_attribute_weapon_proficiency",
      attribute_id: "weapon_proficiency",
      value: { type: "reference", value: "deleted_proficiency" },
      evaluated_value: null,
      evaluation_error: null
    };

    const markup = renderToStaticMarkup(
      <ItemAttributesEditor
        values={values}
        definitions={{
          weapon_proficiency: {
            id: "weapon_proficiency",
            name: "Proficiency",
            subject_types: ["item"],
            value_type: "reference",
            default_value: { type: "reference", value: "" },
            reference_kind: "proficiency",
            required: false
          }
        }}
        proficiencies={{}}
        metadata={null}
        onChange={() => undefined}
      />
    );

    expect(markup).toContain('placeholder="Search proficiency catalog"');
    expect(markup).toContain("Missing proficiency reference: deleted_proficiency");
    expect(markup).toContain("Select a valid replacement");
    expect(markup).not.toContain("Save Value");
    expect(markup).toContain('value=""');
    expect(markup).not.toContain('value="deleted_proficiency"');
  });

  it("sorts and deduplicates authoritative proficiency definitions", () => {
    expect(
      selectAuthoritativeProficiencies({
        first: { id: "shared", name: "Zulu", description: "", default_growth_rate: 0.01 },
        duplicate: {
          id: "shared",
          name: "Duplicate",
          description: "",
          default_growth_rate: 0.01
        },
        alpha: { id: "alpha", name: "Alpha", description: "", default_growth_rate: 0.01 }
      }).map((proficiency) => proficiency.id)
    ).toEqual(["alpha", "shared"]);
  });
});
