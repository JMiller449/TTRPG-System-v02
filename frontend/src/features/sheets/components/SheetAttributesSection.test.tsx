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
});
