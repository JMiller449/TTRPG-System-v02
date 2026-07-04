import { describe, expect, it } from "vitest";
import { emptyAttributeDraft, attributePayloadFromDraft } from "@/features/attributes/attributeEditorValues";

describe("AttributeAuthoringPage values", () => {
  it("preserves formula aliases in an authored numeric Attribute", () => {
    const draft = emptyAttributeDraft();
    draft.name = "Reaction Limit";
    draft.numberMode = "formula";
    draft.defaultText = "@registration + @reaction_time";
    draft.formulaAliases = [
      { name: "registration", path: ["stats", "registration"] },
      { name: "reaction_time", path: ["stats", "reaction_time"] }
    ];

    expect(attributePayloadFromDraft(draft, "reaction_limit")?.default_value).toEqual({
      type: "formula",
      formula: {
        aliases: draft.formulaAliases,
        text: "@registration + @reaction_time"
      }
    });
  });

  it("requires validation metadata for constrained Attribute types", () => {
    const draft = emptyAttributeDraft();
    draft.name = "Weapon Type";
    draft.valueType = "enum";
    draft.defaultText = "Sword";

    expect(attributePayloadFromDraft(draft, "weapon_type")).toBeNull();

    draft.validationOptions = "Sword, Axe";
    expect(attributePayloadFromDraft(draft, "weapon_type")).toMatchObject({
      validation_options: ["Sword", "Axe"],
      default_value: { type: "enum", value: "Sword" }
    });
  });
});
