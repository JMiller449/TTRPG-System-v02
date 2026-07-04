import type { AttributeDefinition, AttributeValue, FormulaAlias } from "@/domain/models";
import type { AttributeDefinitionPayload } from "@/infrastructure/ws/requestBuilders";

type AttributeValueType = AttributeDefinition["value_type"];

export interface AttributeDraft {
  name: string;
  description: string;
  subjectTypes: Array<"sheet" | "item" | "action">;
  valueType: AttributeValueType;
  numberMode: "literal" | "formula";
  formulaAliases: FormulaAlias[];
  defaultText: string;
  unit: string;
  visibility: "public" | "gm_only";
  validationOptions: string;
  referenceKind: string;
}

export function emptyAttributeDraft(): AttributeDraft {
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

function valueFromDraft(draft: AttributeDraft): AttributeValue | null {
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

export function attributePayloadFromDraft(draft: AttributeDraft, id: string): AttributeDefinitionPayload | null {
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
