import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ItemAttributesEditor } from "@/features/items/components/ItemAttributesEditor";
import { selectAuthoritativeProficiencies } from "@/features/items/proficiencyOptions";
import { createEmptyItemValues } from "@/features/items/itemEditorValues";

describe("ItemAttributesEditor", () => {
  it("renders backend-declared profiles and proficiency reference choices", () => {
    const values = createEmptyItemValues();
    values.attributeProfile = "weapon";
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
        metadata={null}
        onChange={() => undefined}
      />
    );

    expect(markup).toContain("Attribute profile");
    expect(markup).toContain('value="weapon" selected=""');
    expect(markup).toContain("Proficiency");
    expect(markup).toContain('value="long_swords" selected=""');
    expect(markup).toContain("Required");
  });

  it("does not offer missing proficiency references as selectable choices", () => {
    const values = createEmptyItemValues();
    values.attributeProfile = "weapon";
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
            required: true,
            required_profile: "weapon"
          }
        }}
        proficiencies={{}}
        metadata={null}
        onChange={() => undefined}
      />
    );

    expect(markup).toContain("No options available");
    expect(markup).toContain("Missing proficiency reference: deleted_proficiency");
    expect(markup).toContain("Select a valid replacement");
    expect(markup).not.toContain("Save Value");
    expect(markup).toContain("disabled");
    expect(markup).not.toContain('value="deleted_proficiency"');
  });

  it("sorts and deduplicates authoritative proficiency definitions", () => {
    expect(
      selectAuthoritativeProficiencies({
        first: { id: "shared", name: "Zulu", description: "" },
        duplicate: { id: "shared", name: "Duplicate", description: "" },
        alpha: { id: "alpha", name: "Alpha", description: "" }
      }).map((proficiency) => proficiency.id)
    ).toEqual(["alpha", "shared"]);
  });
});
