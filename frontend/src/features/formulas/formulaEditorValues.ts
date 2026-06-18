import type { FormulaAlias, FormulaDefinition } from "@/domain/models";
import type { FormulaDefinitionPayload } from "@/infrastructure/ws/requestBuilders";

export interface FormulaEditorValues {
  formulaText: string;
  aliases: FormulaAlias[] | null;
}

export function createEmptyFormulaEditorValues(): FormulaEditorValues {
  return {
    formulaText: "",
    aliases: null
  };
}

function cloneAliases(aliases: FormulaAlias[] | null | undefined): FormulaAlias[] | null {
  return aliases?.map((alias) => ({ ...alias, path: [...alias.path] })) ?? null;
}

export function toFormulaEditorValues(formula: FormulaDefinition): FormulaEditorValues {
  return {
    formulaText: formula.formula.text,
    aliases: cloneAliases(formula.formula.aliases)
  };
}

export function toFormulaDefinitionPayload(
  values: FormulaEditorValues,
  formulaId: string
): FormulaDefinitionPayload {
  return {
    id: formulaId,
    formula: {
      aliases: cloneAliases(values.aliases),
      text: values.formulaText.trim()
    }
  };
}

export function toUpdatedFormulaDefinitionPayload(
  formula: FormulaDefinition,
  values: FormulaEditorValues
): FormulaDefinitionPayload {
  return {
    id: formula.id,
    formula: {
      aliases: cloneAliases(values.aliases),
      text: values.formulaText.trim()
    }
  };
}
