import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SheetAttributesSection } from "@/features/sheets/components/SheetAttributesSection";

const definitions = {
  amount_of_reactions: {
    id: "amount_of_reactions",
    name: "Amount of Reactions",
    description: "Informational reaction amount.",
    subject_types: ["sheet" as const],
    value_type: "number" as const,
    default_value: {
      type: "formula" as const,
      formula: { aliases: null, text: "1" }
    },
    unit: "reactions",
    required: true
  }
};

const bridges = {
  amount_of_reactions: {
    relationship_id: "required_attribute_amount_of_reactions",
    attribute_id: "amount_of_reactions",
    value: {
      type: "formula" as const,
      formula: {
        aliases: [{ name: "registration", path: ["stats", "registration"] }],
        text: "@registration + 2"
      }
    },
    evaluated_value: 12,
    evaluation_error: null
  }
};

describe("SheetAttributesSection", () => {
  it("renders the authoritative value without edit controls for players", () => {
    const markup = renderToStaticMarkup(
      <SheetAttributesSection
        definitions={definitions}
        bridges={bridges}
        canEdit={false}
        onSaveFormula={() => undefined}
        onReset={() => undefined}
      />
    );

    expect(markup).toContain("Amount of Reactions");
    expect(markup).toContain("12 reactions");
    expect(markup).toContain("Required");
    expect(markup).not.toContain("<button");
  });

  it("renders formula editing and reset controls for a GM", () => {
    const markup = renderToStaticMarkup(
      <SheetAttributesSection
        definitions={definitions}
        bridges={bridges}
        canEdit
        onSaveFormula={() => undefined}
        onReset={() => undefined}
      />
    );

    expect(markup).toContain("@registration + 2");
    expect(markup).toContain("Save Formula");
    expect(markup).toContain("Reset to Default");
  });

  it("uses standalone cards without a repeated title in page layout", () => {
    const markup = renderToStaticMarkup(
      <SheetAttributesSection
        definitions={definitions}
        bridges={bridges}
        canEdit={false}
        pageLayout
        onSaveFormula={() => undefined}
        onReset={() => undefined}
      />
    );

    expect(markup).toContain("sheet-attributes--page");
    expect(markup).toContain('aria-label="Attribute values"');
    expect(markup).toContain("Informational reaction amount.");
    expect(markup).not.toContain("sheet-attributes-title");
  });

  it("keeps page-layout attach controls outside the attribute card grid", () => {
    const markup = renderToStaticMarkup(
      <SheetAttributesSection
        definitions={{
          ...definitions,
          optional_note: {
            id: "optional_note",
            name: "Optional Note",
            description: "Optional text.",
            subject_types: ["sheet"],
            value_type: "text",
            default_value: { type: "text", value: "" },
            required: false
          }
        }}
        bridges={bridges}
        canEdit
        pageLayout
        onSaveFormula={() => undefined}
        onReset={() => undefined}
        onAttach={() => undefined}
      />
    );

    expect(markup).toContain("sheet-attributes__attach");
    expect(markup).toContain(">Attach Attribute</button>");
  });

  it("renders validated physical damage types as a multi-value dropdown", () => {
    const markup = renderToStaticMarkup(
      <SheetAttributesSection
        definitions={{
          weapon_damage_types: {
            id: "weapon_damage_types",
            name: "Physical Damage Types",
            description: "Physical damage types this weapon can deal.",
            subject_types: ["item"],
            value_type: "list",
            default_value: { type: "list", value: [] },
            validation_options: ["Slashing", "Bludgeoning", "Piercing"],
            required: true,
            required_profile: "weapon"
          }
        }}
        bridges={{
          weapon_damage_types: {
            relationship_id: "required_attribute_weapon_damage_types",
            attribute_id: "weapon_damage_types",
            value: { type: "list", value: ["Slashing"] },
            evaluated_value: ["Slashing"],
            evaluation_error: null
          }
        }}
        canEdit
        draftMode
        subjectType="item"
        onSaveFormula={() => undefined}
        onSaveValue={() => undefined}
        onReset={() => undefined}
      />
    );

    expect(markup).toContain('aria-label="Physical Damage Types option"');
    expect(markup).toContain('<option value="Slashing" disabled="">Slashing</option>');
    expect(markup).toContain('<option value="Bludgeoning">Bludgeoning</option>');
    expect(markup).toContain('<option value="Piercing">Piercing</option>');
    expect(markup).toContain('aria-label="Remove Slashing"');
    expect(markup).not.toContain("Allowed values:");
  });
});
