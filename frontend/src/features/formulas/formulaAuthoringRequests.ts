import type { FormulaDefinition } from "@/domain/models";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";
import {
  buildCreateFormulaRequest,
  buildDeleteFormulaRequest,
  buildUpdateFormulaRequest
} from "@/infrastructure/ws/requestBuilders";
import {
  toFormulaDefinitionPayload,
  toUpdatedFormulaDefinitionPayload,
  type FormulaEditorValues
} from "@/features/formulas/formulaEditorValues";

export interface FormulaAuthoringSubmission {
  request: ProtocolApplicationRequest;
  label: string;
}

export function selectOrderedFormulaDefinitions(
  formulaRecords: Record<string, FormulaDefinition>,
  formulaOrder: string[]
): FormulaDefinition[] {
  return formulaOrder.map((id) => formulaRecords[id]).filter((formula): formula is FormulaDefinition => Boolean(formula));
}

export function buildCreateFormulaSubmission(
  values: FormulaEditorValues,
  formulaId: string
): FormulaAuthoringSubmission | null {
  if (!values.formulaText.trim()) {
    return null;
  }

  const formula = toFormulaDefinitionPayload(values, formulaId);
  return {
    request: buildCreateFormulaRequest({ formula }),
    label: `Create formula: ${formula.id}`
  };
}

export function buildUpdateFormulaSubmission(
  formula: FormulaDefinition | undefined,
  values: FormulaEditorValues
): FormulaAuthoringSubmission | null {
  if (!formula || !values.formulaText.trim()) {
    return null;
  }

  const updatedFormula = toUpdatedFormulaDefinitionPayload(formula, values);
  return {
    request: buildUpdateFormulaRequest({
      formulaId: formula.id,
      formula: updatedFormula
    }),
    label: `Update formula: ${updatedFormula.id}`
  };
}

export function buildDeleteFormulaSubmission(
  formulaId: string,
  formula: FormulaDefinition | undefined
): FormulaAuthoringSubmission {
  return {
    request: buildDeleteFormulaRequest({ formulaId }),
    label: `Delete formula: ${formula?.id ?? "formula"}`
  };
}
