import { describe, expect, it } from "vitest";
import type { FormulaDefinition } from "@/domain/models";
import { createEmptyFormulaEditorValues } from "@/features/formulas/formulaEditorValues";
import {
  buildCreateFormulaSubmission,
  buildDeleteFormulaSubmission,
  buildUpdateFormulaSubmission,
  selectOrderedFormulaDefinitions
} from "@/features/formulas/formulaAuthoringRequests";

function testFormula(overrides: Partial<FormulaDefinition> = {}): FormulaDefinition {
  return {
    id: "formula_1",
    formula: {
      aliases: [
        {
          name: "arcane",
          path: ["sheet", "stats", "arcane"]
        }
      ],
      text: "@arcane * 8"
    },
    ...overrides
  };
}

describe("formulaAuthoringRequests", () => {
  it("selects authoritative formulas in server formula order", () => {
    const first = testFormula({ id: "formula_1" });
    const second = testFormula({ id: "formula_2" });

    expect(
      selectOrderedFormulaDefinitions(
        {
          formula_1: first,
          formula_2: second
        },
        ["formula_2", "missing_formula", "formula_1"]
      )
    ).toEqual([second, first]);
  });

  it("builds create submissions from editor values", () => {
    const values = createEmptyFormulaEditorValues();
    values.formulaText = "  @arcane * 10  ";

    expect(buildCreateFormulaSubmission(values, "formula_created")).toEqual({
      request: {
        type: "create_formula",
        formula: {
          id: "formula_created",
          formula: {
            aliases: null,
            text: "@arcane * 10"
          }
        }
      },
      label: "Create formula: formula_created"
    });
  });

  it("does not build create or update submissions for blank formulas", () => {
    const values = createEmptyFormulaEditorValues();
    values.formulaText = "   ";

    expect(buildCreateFormulaSubmission(values, "formula_created")).toBeNull();
    expect(buildUpdateFormulaSubmission(testFormula(), values)).toBeNull();
  });

  it("builds update submissions without dropping aliases", () => {
    const values = createEmptyFormulaEditorValues();
    values.formulaText = " @arcane * 12 ";
    values.aliases = [
      {
        name: "arcane",
        path: ["sheet", "stats", "arcane"]
      }
    ];

    expect(buildUpdateFormulaSubmission(testFormula(), values)).toEqual({
      request: {
        type: "update_formula",
        formula_id: "formula_1",
        formula: {
          id: "formula_1",
          formula: {
            aliases: [
              {
                name: "arcane",
                path: ["sheet", "stats", "arcane"]
              }
            ],
            text: "@arcane * 12"
          }
        }
      },
      label: "Update formula: formula_1"
    });
  });

  it("does not build update submissions without a selected formula", () => {
    const values = createEmptyFormulaEditorValues();
    values.formulaText = "@arcane * 8";

    expect(buildUpdateFormulaSubmission(undefined, values)).toBeNull();
  });

  it("builds delete submissions with formula labels and a missing-formula fallback", () => {
    expect(buildDeleteFormulaSubmission("formula_1", testFormula())).toEqual({
      request: {
        type: "delete_formula",
        formula_id: "formula_1"
      },
      label: "Delete formula: formula_1"
    });

    expect(buildDeleteFormulaSubmission("formula_missing", undefined)).toEqual({
      request: {
        type: "delete_formula",
        formula_id: "formula_missing"
      },
      label: "Delete formula: formula"
    });
  });
});
