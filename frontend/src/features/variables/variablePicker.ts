import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { FormulaAlias } from "@/domain/models";

type AuthoringVariable = ActionFormulaAuthoringMetadata["variables"][number];

export interface VariablePickerEntry {
  key: string;
  label: string;
  root: AuthoringVariable["root"];
  path: string[];
  valueType: AuthoringVariable["value_type"];
  description: string;
  shortcuts: string[];
  formulaReferenceAllowed: boolean;
  actionMutationAllowed: boolean;
  token: string;
  alias: FormulaAlias;
}

export type VariablePickerMode = "formula" | "mutation";

function variableAliasName(variable: AuthoringVariable): string {
  const firstShortcut = variable.shortcuts?.find((shortcut) => shortcut.trim().length > 0);
  return firstShortcut ?? variable.path.at(-1) ?? variable.key;
}

function aliasPath(variable: AuthoringVariable): string[] {
  return [variable.root, ...variable.path];
}

export function variablePathLabel(entry: Pick<VariablePickerEntry, "root" | "path">): string {
  return `${entry.root}.${entry.path.join(".")}`;
}

export function buildVariablePickerEntries(
  metadata: ActionFormulaAuthoringMetadata | null,
  mode: VariablePickerMode
): VariablePickerEntry[] {
  const variables = metadata?.variables ?? [];
  return variables
    .filter((variable) =>
      mode === "formula" ? variable.formula_reference_allowed !== false : variable.action_mutation_allowed ?? false
    )
    .map((variable) => {
      const aliasName = variableAliasName(variable);
      return {
        key: variable.key,
        label: variable.label,
        root: variable.root,
        path: [...variable.path],
        valueType: variable.value_type,
        description: variable.description ?? "",
        shortcuts: [...(variable.shortcuts ?? [])],
        formulaReferenceAllowed: variable.formula_reference_allowed !== false,
        actionMutationAllowed: variable.action_mutation_allowed ?? false,
        token: `@${aliasName}`,
        alias: {
          name: aliasName,
          path: aliasPath(variable)
        }
      };
    })
    .sort((left, right) => {
      const rootCompare = left.root.localeCompare(right.root);
      if (rootCompare !== 0) {
        return rootCompare;
      }
      return left.label.localeCompare(right.label);
    });
}

export function filterVariablePickerEntries(
  entries: VariablePickerEntry[],
  query: string
): VariablePickerEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return entries;
  }

  return entries.filter((entry) => {
    const searchable = [
      entry.label,
      entry.key,
      entry.root,
      entry.valueType,
      variablePathLabel(entry),
      entry.description,
      ...entry.shortcuts
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(normalizedQuery);
  });
}

export function appendFormulaToken(text: string, token: string): string {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return text;
  }

  if (!text.trim()) {
    return trimmedToken;
  }

  return `${text.trimEnd()} ${trimmedToken}`;
}

export function upsertFormulaAlias(
  aliases: FormulaAlias[] | null,
  alias: FormulaAlias
): FormulaAlias[] {
  const nextAliases = aliases?.map((entry) => ({ ...entry, path: [...entry.path] })) ?? [];
  const existingIndex = nextAliases.findIndex((entry) => entry.name === alias.name);
  const nextAlias = {
    name: alias.name,
    path: [...alias.path]
  };

  if (existingIndex >= 0) {
    nextAliases[existingIndex] = nextAlias;
    return nextAliases;
  }

  return [...nextAliases, nextAlias];
}
