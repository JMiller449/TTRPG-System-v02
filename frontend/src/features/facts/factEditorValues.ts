import type { FactDefinition, FactValue, FormulaAlias } from "@/domain/models";
import type { FactDefinitionPayload } from "@/infrastructure/ws/requestBuilders";

type FactValueType = FactDefinition["value_type"];

export interface FactDraft {
  name: string;
  description: string;
  subjectTypes: Array<"sheet" | "item" | "action">;
  valueType: FactValueType;
  numberMode: "literal" | "formula";
  formulaAliases: FormulaAlias[];
  defaultText: string;
  unit: string;
  visibility: "public" | "gm_only";
  validationOptions: string;
  referenceKind: string;
}

export function emptyFactDraft(): FactDraft {
  return {
    name: "",
    description: "",
    subjectTypes: ["sheet"],
    valueType: "number",
    numberMode: "literal",
    formulaAliases: [],
    defaultText: "0",
    unit: "",
    visibility: "public",
    validationOptions: "",
    referenceKind: ""
  };
}

function valueFromDraft(draft: FactDraft): FactValue | null {
  if (draft.valueType === "number") {
    if (draft.numberMode === "formula") {
      return draft.defaultText.trim()
        ? {
            type: "formula",
            formula: {
              aliases: draft.formulaAliases.length > 0 ? draft.formulaAliases : null,
              text: draft.defaultText.trim()
            }
          }
        : null;
    }
    const value = Number(draft.defaultText);
    return Number.isFinite(value) ? { type: "number", value } : null;
  }
  if (draft.valueType === "boolean") {
    return { type: "boolean", value: draft.defaultText === "true" };
  }
  if (draft.valueType === "list") {
    return {
      type: "list",
      value: draft.defaultText
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    };
  }
  return { type: draft.valueType, value: draft.defaultText.trim() };
}

export function factPayloadFromDraft(draft: FactDraft, id: string): FactDefinitionPayload | null {
  const value = valueFromDraft(draft);
  const validationOptions = draft.validationOptions
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const requiresValidation = ["enum", "list"].includes(draft.valueType);
  if (!draft.name.trim() || draft.subjectTypes.length === 0 || !value) {
    return null;
  }
  if (requiresValidation && validationOptions.length === 0) {
    return null;
  }
  if (draft.valueType === "reference" && !draft.referenceKind.trim()) {
    return null;
  }
  return {
    id,
    name: draft.name.trim(),
    description: draft.description.trim(),
    subject_types: draft.subjectTypes,
    value_type: draft.valueType,
    default_value: value,
    unit: draft.unit.trim(),
    visibility: draft.visibility,
    validation_options: ["enum", "reference", "list"].includes(draft.valueType)
      ? validationOptions
      : [],
    reference_kind: draft.valueType === "reference" ? draft.referenceKind.trim() : null,
    required: false
  };
}
