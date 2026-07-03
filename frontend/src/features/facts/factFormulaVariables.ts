import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { FormulaAlias } from "@/domain/models";
import type { SearchPopoverOption } from "@/shared/ui/searchPopover";

type FactFormulaVariable = NonNullable<
  ActionFormulaAuthoringMetadata["fact_formula_variables"]
>[number];

export interface FactFormulaVariableEntry {
  key: string;
  label: string;
  subjectTypes: FactFormulaVariable["subject_types"];
  path: string[];
  valueType: FactFormulaVariable["value_type"];
  description: string;
  shortcuts: string[];
  token: string;
  alias: FormulaAlias;
}

function aliasName(variable: FactFormulaVariable): string {
  return (
    variable.shortcuts?.find((shortcut) => shortcut.trim().length > 0) ??
    variable.path.at(-1) ??
    variable.key
  );
}

export function buildFactFormulaVariableEntries(
  metadata: ActionFormulaAuthoringMetadata | null,
  subjectTypes: FactFormulaVariable["subject_types"]
): FactFormulaVariableEntry[] {
  if (subjectTypes.length === 0) {
    return [];
  }
  return (metadata?.fact_formula_variables ?? [])
    .filter((variable) =>
      subjectTypes.every((subjectType) => variable.subject_types.includes(subjectType))
    )
    .map((variable) => {
      const name = aliasName(variable);
      return {
        key: variable.key,
        label: variable.label,
        subjectTypes: [...variable.subject_types],
        path: [...variable.path],
        valueType: variable.value_type,
        description: variable.description ?? "",
        shortcuts: [...(variable.shortcuts ?? [])],
        token: `@${name}`,
        alias: { name, path: [...variable.path] }
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function toFactFormulaVariableOptions(
  entries: FactFormulaVariableEntry[]
): SearchPopoverOption<FactFormulaVariableEntry>[] {
  return entries.map((entry) => ({
    id: entry.key,
    label: entry.label,
    secondary: `${entry.token} | ${entry.path.join(".")} | ${entry.valueType}`,
    keywords: [
      entry.key,
      entry.path.join("."),
      entry.valueType,
      entry.description,
      entry.token,
      ...entry.shortcuts
    ],
    value: entry
  }));
}
