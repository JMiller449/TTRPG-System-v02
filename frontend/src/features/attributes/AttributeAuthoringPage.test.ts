import { describe, expect, it } from "vitest";
import {
  emptyAttributeDraft,
  attributePayloadFromDraft
} from "@/features/attributes/attributeEditorValues";

describe("AttributeAuthoringPage values", () => {
  it("stores a canonical formula reference in an authored numeric Attribute", () => {
    const draft = emptyAttributeDraft();
    draft.name = "Reaction Limit";
    draft.numberMode = "formula";
    draft.formulaId = "reaction_limit_formula";

    expect(attributePayloadFromDraft(draft, "reaction_limit")?.default_value).toEqual({
      type: "formula",
      formula: {
        type: "formula_reference",
        formula_id: "reaction_limit_formula"
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
