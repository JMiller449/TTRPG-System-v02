import { describe, expect, it } from "vitest";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import { buildAttributeFormulaVariableEntries } from "@/features/attributes/attributeFormulaVariables";

const metadata = {
  attribute_formula_variables: [
    {
      key: "attribute_formula.sheet.stats.strength",
      label: "Strength",
      subject_types: ["sheet"],
      path: ["stats", "strength"],
      value_type: "number",
      shortcuts: ["str", "strength"]
    },
    {
      key: "attribute_formula.attributes.power",
      label: "Attribute: Power",
      subject_types: ["sheet", "item"],
      path: ["attributes", "power"],
      value_type: "number",
      shortcuts: ["power"]
    }
  ]
} as ActionFormulaAuthoringMetadata;

describe("attribute formula variables", () => {
  it("only offers variables valid for every selected subject", () => {
    expect(
      buildAttributeFormulaVariableEntries(metadata, ["sheet", "item"]).map((entry) => entry.key)
    ).toEqual(["attribute_formula.attributes.power"]);
  });

  it("builds relative Attribute aliases and insertion tokens", () => {
    const [entry] = buildAttributeFormulaVariableEntries(metadata, ["sheet"]);

    expect(entry.token).toBe("@power");
    expect(entry.alias).toEqual({ name: "power", path: ["attributes", "power"] });
  });
});
