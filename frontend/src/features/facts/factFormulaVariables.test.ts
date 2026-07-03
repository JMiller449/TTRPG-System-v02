import { describe, expect, it } from "vitest";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import { buildFactFormulaVariableEntries } from "@/features/facts/factFormulaVariables";

const metadata = {
  fact_formula_variables: [
    {
      key: "fact_formula.sheet.stats.strength",
      label: "Strength",
      subject_types: ["sheet"],
      path: ["stats", "strength"],
      value_type: "number",
      shortcuts: ["str", "strength"]
    },
    {
      key: "fact_formula.facts.power",
      label: "Fact: Power",
      subject_types: ["sheet", "item"],
      path: ["facts", "power"],
      value_type: "number",
      shortcuts: ["power"]
    }
  ]
} as ActionFormulaAuthoringMetadata;

describe("fact formula variables", () => {
  it("only offers variables valid for every selected subject", () => {
    expect(
      buildFactFormulaVariableEntries(metadata, ["sheet", "item"]).map((entry) => entry.key)
    ).toEqual(["fact_formula.facts.power"]);
  });

  it("builds relative Fact aliases and insertion tokens", () => {
    const [entry] = buildFactFormulaVariableEntries(metadata, ["sheet"]);

    expect(entry.token).toBe("@power");
    expect(entry.alias).toEqual({ name: "power", path: ["facts", "power"] });
  });
});
