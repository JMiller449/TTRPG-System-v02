import { describe, expect, it } from "vitest";
import { emptyFactDraft, factPayloadFromDraft } from "@/features/facts/factEditorValues";

describe("FactAuthoringPage values", () => {
  it("preserves formula aliases in an authored numeric Fact", () => {
    const draft = emptyFactDraft();
    draft.name = "Reaction Limit";
    draft.numberMode = "formula";
    draft.defaultText = "@registration + @reaction_time";
    draft.formulaAliases = [
      { name: "registration", path: ["stats", "registration"] },
      { name: "reaction_time", path: ["stats", "reaction_time"] }
    ];

    expect(factPayloadFromDraft(draft, "reaction_limit")?.default_value).toEqual({
      type: "formula",
      formula: {
        aliases: draft.formulaAliases,
        text: "@registration + @reaction_time"
      }
    });
  });

  it("requires validation metadata for constrained Fact types", () => {
    const draft = emptyFactDraft();
    draft.name = "Weapon Type";
    draft.valueType = "enum";
    draft.defaultText = "Sword";

    expect(factPayloadFromDraft(draft, "weapon_type")).toBeNull();

    draft.validationOptions = "Sword, Axe";
    expect(factPayloadFromDraft(draft, "weapon_type")).toMatchObject({
      validation_options: ["Sword", "Axe"],
      default_value: { type: "enum", value: "Sword" }
    });
  });
});
