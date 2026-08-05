// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
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

    expect(markup).toContain("sheet-attribute-summary");
    expect(markup).toContain("Proficiency");
    expect(markup).toContain("Add Existing");
    expect(markup).not.toContain("Attach Attribute");
    expect(markup).not.toContain('placeholder="Search proficiency catalog"');
    expect(markup).not.toContain("Save Value");
  });

  it("does not offer missing proficiency references in the focused editor", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const values = createEmptyItemValues();
    values.attributes.weapon_proficiency = {
      relationship_id: "required_attribute_weapon_proficiency",
      attribute_id: "weapon_proficiency",
      value: { type: "reference", value: "deleted_proficiency" },
      evaluated_value: null,
      evaluation_error: null
    };

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
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
    });

    const editButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label^="Edit Proficiency"]'
    );
    await act(async () => editButton?.click());
    const markup = container.querySelector<HTMLElement>('[role="dialog"]')?.innerHTML ?? "";

    expect(markup).toContain('placeholder="Search proficiency catalog"');
    expect(markup).toContain("Missing proficiency reference: deleted_proficiency");
    expect(markup).toContain("Select a valid replacement");
    expect(markup).not.toContain("Save Value");
    expect(markup).toContain('value=""');
    expect(markup).not.toContain('value="deleted_proficiency"');

    await act(async () => root.unmount());
    container.remove();
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
