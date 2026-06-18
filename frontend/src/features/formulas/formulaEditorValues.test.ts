import { describe, expect, it } from "vitest";
import type { FormulaDefinition } from "@/domain/models";
import {
  createEmptyFormulaEditorValues,
  toFormulaDefinitionPayload,
  toFormulaEditorValues,
  toUpdatedFormulaDefinitionPayload
} from "@/features/formulas/formulaEditorValues";

function testFormula(overrides: Partial<FormulaDefinition> = {}): FormulaDefinition {
  return {
    id: "formula_1",
    formula: {
      aliases: [
        {
          name: "arcane",
          path: ["sheet", "stats", "arcane"]
        },
        {
          name: "mana",
          path: ["instance", "mana"]
        }
      ],
      text: "@arcane * 8 + @mana"
    },
    ...overrides
  };
}

describe("formulaEditorValues", () => {
  it("creates empty formula editor values", () => {
    expect(createEmptyFormulaEditorValues()).toEqual({
      formulaText: "",
      aliases: null
    });
  });

  it("maps backend formula definitions into editor values with aliases preserved", () => {
    expect(toFormulaEditorValues(testFormula())).toEqual({
      formulaText: "@arcane * 8 + @mana",
      aliases: [
        {
          name: "arcane",
          path: ["sheet", "stats", "arcane"]
        },
        {
          name: "mana",
          path: ["instance", "mana"]
        }
      ]
    });
  });

  it("maps new editor values to backend formula payloads", () => {
    const values = createEmptyFormulaEditorValues();
    values.formulaText = "  @arcane * 10  ";

    expect(toFormulaDefinitionPayload(values, "formula_created")).toEqual({
      id: "formula_created",
      formula: {
        aliases: null,
        text: "@arcane * 10"
      }
    });
  });

  it("maps formula edits to backend payloads without dropping aliases or paths", () => {
    const formula = testFormula();
    const values = toFormulaEditorValues(formula);
    values.formulaText = "  @arcane * 12 + @mana  ";

    expect(toUpdatedFormulaDefinitionPayload(formula, values)).toEqual({
      id: "formula_1",
      formula: {
        aliases: [
          {
            name: "arcane",
            path: ["sheet", "stats", "arcane"]
          },
          {
            name: "mana",
            path: ["instance", "mana"]
          }
        ],
        text: "@arcane * 12 + @mana"
      }
    });
  });

  it("clones alias paths so editor mutations do not mutate the authoritative formula record", () => {
    const formula = testFormula();
    const values = toFormulaEditorValues(formula);
    values.aliases?.[0]?.path.push("mutated");

    expect(formula.formula.aliases?.[0]?.path).toEqual(["sheet", "stats", "arcane"]);
  });
});
