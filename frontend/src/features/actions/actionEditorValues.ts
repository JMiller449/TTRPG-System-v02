import type {
  ActionDefinition,
  FactBridge,
  FactDefinition,
  FormulaAlias,
  ProficiencyDefinition
} from "@/domain/models";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import { normalizeFormulaTags } from "@/features/formulas/formulaTags";
import type { ActionDefinitionPayload } from "@/infrastructure/ws/requestBuilders";

export type ActionEditorSteps = NonNullable<ActionDefinitionPayload["steps"]>;
export type ActionEditorStep = ActionEditorSteps[number];
export type SendMessageEditorStep = Extract<ActionEditorStep, { type: "send_message" }>;
export type CalculateValueEditorStep = Extract<ActionEditorStep, { type: "calculate_value" }>;
export type ResolveDamageEditorStep = Extract<ActionEditorStep, { type: "resolve_damage" }>;
export type IncrementValueEditorStep = Extract<ActionEditorStep, { type: "increment_value" }>;
export type SetValueEditorStep = Extract<ActionEditorStep, { type: "set_value" }>;
export type DecrementValueEditorStep = Extract<ActionEditorStep, { type: "decrement_value" }>;
export type BoundedMutationEditorStep =
  | SetValueEditorStep
  | IncrementValueEditorStep
  | DecrementValueEditorStep;
export type ApplyAugmentationEditorStep = Extract<ActionEditorStep, { type: "apply_augmentation" }>;
export type ApplyConditionPresetEditorStep = Extract<
  ActionEditorStep,
  { type: "apply_condition_preset" }
>;
export type GainProficiencyUseEditorStep = Extract<
  ActionEditorStep,
  { type: "gain_proficiency_use" }
>;

export interface ActionEditorValues {
  name: string;
  rollModeKind: NonNullable<ActionDefinitionPayload["roll_mode_kind"]>;
  notes: string;
  steps: ActionEditorSteps;
  facts: Record<string, FactBridge>;
}

export type ActionPresetTemplate =
  ActionFormulaAuthoringMetadata["action_preset_templates"][number];

export function createEmptyActionEditorValues(): ActionEditorValues {
  return {
    name: "",
    rollModeKind: "none",
    notes: "",
    steps: [],
    facts: {}
  };
}

export type EditorNumericValueSource = ResolveDamageEditorStep["amount"];
type EditorFormulaValue = Exclude<
  EditorNumericValueSource,
  { type: "calculated_value" } | { type: "formula_reference" }
>;

export function isCalculatedValueReference(
  value: EditorNumericValueSource
): value is Extract<EditorNumericValueSource, { type: "calculated_value" }> {
  return "type" in value && value.type === "calculated_value";
}

export function isFormulaReference(
  value: EditorNumericValueSource
): value is Extract<EditorNumericValueSource, { type: "formula_reference" }> {
  return "type" in value && value.type === "formula_reference";
}

export function isInlineFormula(value: EditorNumericValueSource): value is EditorFormulaValue {
  return !isCalculatedValueReference(value) && !isFormulaReference(value);
}

function emptyFormulaValue(text = ""): EditorFormulaValue {
  return { aliases: null, text };
}

export function calculatedValuesBeforeStep(
  values: ActionEditorValues,
  stepId: string
): Array<{ stepId: string; variableId: string }> {
  const stepIndex = values.steps.findIndex((step) => step.step_id === stepId);
  return values.steps
    .slice(0, stepIndex < 0 ? values.steps.length : stepIndex)
    .filter((step): step is CalculateValueEditorStep => step.type === "calculate_value")
    .map((step) => ({ stepId: step.step_id, variableId: step.variable_id }));
}

function cloneActionSteps(
  steps: ActionDefinition["steps"] | ActionEditorSteps | undefined
): ActionEditorSteps {
  return structuredClone(steps ?? []) as ActionEditorSteps;
}

function cloneActionEditorValues(values: ActionEditorValues): ActionEditorValues {
  return {
    ...values,
    steps: cloneActionSteps(values.steps),
    facts: structuredClone(values.facts)
  };
}

export interface ActionFactValidationContext {
  definitions?: Record<string, FactDefinition>;
  proficiencies?: Record<string, ProficiencyDefinition>;
}

export function getActionEditorValidationError(
  values: ActionEditorValues,
  context: ActionFactValidationContext = {}
): string | null {
  if (!values.name.trim()) {
    return "Name is required.";
  }
  for (const [factId, bridge] of Object.entries(values.facts)) {
    const definition = context.definitions?.[factId];
    if (!definition || !definition.subject_types.includes("action")) {
      return `Action Fact '${factId}' is unavailable.`;
    }
    const stored = bridge.value.type === "formula" ? null : bridge.value.value;
    if (
      definition.validation_options?.length &&
      typeof stored === "string" &&
      !definition.validation_options.includes(stored)
    ) {
      return `${definition.name} has an unsupported value.`;
    }
    if (definition.reference_kind === "proficiency") {
      const proficiencyId = String(stored ?? "");
      if (!proficiencyId || !context.proficiencies?.[proficiencyId]) {
        return `${definition.name} must reference an existing proficiency.`;
      }
    }
    if (
      ["action_range", "action_mana_cost", "action_base_spell_damage"].includes(factId) &&
      (typeof stored !== "number" || !Number.isFinite(stored) || stored < 0)
    ) {
      return `${definition.name} must be nonnegative.`;
    }
    if (
      factId === "action_target_count" &&
      (typeof stored !== "number" || !Number.isInteger(stored) || stored < 1)
    ) {
      return "Target Count must be a positive whole number.";
    }
  }
  return null;
}

export function applyActionFactValues(
  values: ActionEditorValues,
  factValues: Record<string, FactBridge["value"]>,
  definitions: Record<string, FactDefinition>,
  relationshipIdFactory: () => string
): ActionEditorValues {
  const facts = { ...values.facts };
  for (const [factId, value] of Object.entries(factValues)) {
    if (!definitions[factId]?.subject_types.includes("action")) {
      continue;
    }
    facts[factId] = {
      relationship_id: facts[factId]?.relationship_id ?? relationshipIdFactory(),
      fact_id: factId,
      value: structuredClone(value),
      evaluated_value: null,
      evaluation_error: null
    };
  }
  return { ...values, facts };
}

export function applyActionPresetTemplate(
  values: ActionEditorValues,
  preset: ActionPresetTemplate,
  definitions: Record<string, FactDefinition>,
  relationshipIdFactory: () => string
): ActionEditorValues {
  const nextValues: ActionEditorValues = {
    ...values,
    name: preset.label,
    rollModeKind: preset.roll_mode_kind ?? "none",
    notes: preset.description,
    steps: structuredClone(preset.steps) as ActionEditorSteps
  };
  return applyActionFactValues(
    nextValues,
    preset.fact_values ?? {},
    definitions,
    relationshipIdFactory
  );
}

function cloneAliases(aliases: FormulaAlias[] | null | undefined): FormulaAlias[] | null {
  return aliases?.map((alias) => ({ ...alias, path: [...alias.path] })) ?? null;
}

export function createSendMessageActionStep(
  stepId: string,
  messageText = ""
): SendMessageEditorStep {
  return {
    step_id: stepId,
    type: "send_message",
    message: {
      aliases: null,
      text: messageText
    }
  };
}

export function createCalculateValueActionStep(
  stepId: string,
  variableId = "calculated_value",
  formulaText = ""
): CalculateValueEditorStep {
  return {
    step_id: stepId,
    variable_id: variableId,
    value: emptyFormulaValue(formulaText),
    type: "calculate_value"
  };
}

export function createResolveDamageActionStep(
  stepId: string,
  amountText = "",
  damageType: ResolveDamageEditorStep["damage_type"] = "Slashing"
): ResolveDamageEditorStep {
  return {
    step_id: stepId,
    type: "resolve_damage",
    target: "caster",
    damage_type: damageType,
    amount: {
      aliases: null,
      text: amountText
    }
  };
}

export function createIncrementValueActionStep(
  stepId: string,
  path: string[],
  amountText = ""
): IncrementValueEditorStep {
  return {
    step_id: stepId,
    type: "increment_value",
    target: "caster",
    path: [...path],
    amount: emptyFormulaValue(amountText)
  };
}

export function createSetValueActionStep(
  stepId: string,
  path: string[],
  valueText = ""
): SetValueEditorStep {
  return {
    step_id: stepId,
    type: "set_value",
    target: "caster",
    path: [...path],
    value: emptyFormulaValue(valueText),
    min_value: null,
    max_value: null,
    on_min_violation: "clamp",
    on_max_violation: "clamp"
  };
}

export function createDecrementValueActionStep(
  stepId: string,
  path: string[],
  amountText = ""
): DecrementValueEditorStep {
  return {
    step_id: stepId,
    type: "decrement_value",
    target: "caster",
    path: [...path],
    amount: emptyFormulaValue(amountText),
    min_value: null,
    max_value: null,
    on_min_violation: "clamp",
    on_max_violation: "clamp"
  };
}

export function createApplyAugmentationActionStep(
  stepId: string,
  augmentationId: string
): ApplyAugmentationEditorStep {
  return {
    step_id: stepId,
    type: "apply_augmentation",
    target: "caster",
    augmentation_id: augmentationId,
    operation: "apply"
  };
}

export function createApplyConditionPresetActionStep(
  stepId: string,
  conditionId: string
): ApplyConditionPresetEditorStep {
  return {
    step_id: stepId,
    type: "apply_condition_preset",
    target: "caster",
    condition_id: conditionId,
    operation: "apply"
  };
}

export function createGainProficiencyUseActionStep(
  stepId: string,
  proficiencyId: string,
  amountText = "1"
): GainProficiencyUseEditorStep {
  return {
    step_id: stepId,
    type: "gain_proficiency_use",
    target: "caster",
    proficiency_id: proficiencyId,
    amount: {
      aliases: null,
      text: amountText
    }
  };
}

export function addSendMessageActionStep(
  values: ActionEditorValues,
  stepId: string
): ActionEditorValues {
  return {
    ...values,
    steps: [...cloneActionSteps(values.steps), createSendMessageActionStep(stepId)]
  };
}

export function addCalculateValueActionStep(
  values: ActionEditorValues,
  stepId: string,
  variableId: string
): ActionEditorValues {
  return {
    ...values,
    steps: [...cloneActionSteps(values.steps), createCalculateValueActionStep(stepId, variableId)]
  };
}

export function updateCalculateValueActionStep(
  values: ActionEditorValues,
  stepId: string,
  updates: {
    variableId?: string;
    formulaText?: string;
    aliases?: FormulaAlias[] | null;
    tags?: string[];
  }
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  return {
    ...nextValues,
    steps: nextValues.steps.map((step) =>
      step.step_id === stepId && step.type === "calculate_value"
        ? {
            ...step,
            variable_id: updates.variableId ?? step.variable_id,
            value: isInlineFormula(step.value)
              ? {
                  ...step.value,
                  aliases:
                    updates.aliases === undefined
                      ? step.value.aliases
                      : cloneAliases(updates.aliases),
                  text: updates.formulaText ?? step.value.text,
                  ...(updates.tags === undefined
                    ? {}
                    : { tags: normalizeFormulaTags(updates.tags) })
                }
              : step.value
          }
        : step
    )
  };
}

export function addResolveDamageActionStep(
  values: ActionEditorValues,
  stepId: string
): ActionEditorValues {
  return {
    ...values,
    steps: [...cloneActionSteps(values.steps), createResolveDamageActionStep(stepId)]
  };
}

export function addIncrementValueActionStep(
  values: ActionEditorValues,
  stepId: string,
  path: string[]
): ActionEditorValues {
  return {
    ...values,
    steps: [...cloneActionSteps(values.steps), createIncrementValueActionStep(stepId, path)]
  };
}

export function addSetValueActionStep(
  values: ActionEditorValues,
  stepId: string,
  path: string[]
): ActionEditorValues {
  return {
    ...values,
    steps: [...cloneActionSteps(values.steps), createSetValueActionStep(stepId, path)]
  };
}

export function addDecrementValueActionStep(
  values: ActionEditorValues,
  stepId: string,
  path: string[]
): ActionEditorValues {
  return {
    ...values,
    steps: [...cloneActionSteps(values.steps), createDecrementValueActionStep(stepId, path)]
  };
}

export function addApplyAugmentationActionStep(
  values: ActionEditorValues,
  stepId: string,
  augmentationId: string
): ActionEditorValues {
  return {
    ...values,
    steps: [
      ...cloneActionSteps(values.steps),
      createApplyAugmentationActionStep(stepId, augmentationId)
    ]
  };
}

export function addApplyConditionPresetActionStep(
  values: ActionEditorValues,
  stepId: string,
  conditionId: string
): ActionEditorValues {
  return {
    ...values,
    steps: [
      ...cloneActionSteps(values.steps),
      createApplyConditionPresetActionStep(stepId, conditionId)
    ]
  };
}

export function updateIncrementValueActionStep(
  values: ActionEditorValues,
  stepId: string,
  updates: {
    path?: string[];
    amountText?: string;
    aliases?: FormulaAlias[] | null;
    tags?: string[];
  }
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  return {
    ...nextValues,
    steps: nextValues.steps.map((step) => {
      if (step.step_id !== stepId || step.type !== "increment_value") {
        return step;
      }
      if (!isInlineFormula(step.amount)) {
        return {
          ...step,
          path: updates.path ? [...updates.path] : step.path
        };
      }
      return {
        ...step,
        path: updates.path ? [...updates.path] : step.path,
        amount: {
          ...step.amount,
          aliases:
            updates.aliases === undefined ? step.amount.aliases : cloneAliases(updates.aliases),
          text: updates.amountText ?? step.amount.text,
          ...(updates.tags === undefined ? {} : { tags: normalizeFormulaTags(updates.tags) })
        }
      };
    })
  };
}

export type BoundedMutationSourceSlot = "primary" | "min_value" | "max_value";

export function boundedMutationPrimarySource(
  step: BoundedMutationEditorStep
): EditorNumericValueSource {
  return step.type === "set_value" ? step.value : step.amount;
}

function boundedMutationSlotSource(
  step: BoundedMutationEditorStep,
  slot: BoundedMutationSourceSlot
): EditorNumericValueSource | null | undefined {
  if (slot === "primary") {
    return boundedMutationPrimarySource(step);
  }
  return step[slot];
}

export function setBoundedMutationSource(
  values: ActionEditorValues,
  stepId: string,
  slot: BoundedMutationSourceSlot,
  source: EditorNumericValueSource | null
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  return {
    ...nextValues,
    steps: nextValues.steps.map((step) => {
      if (
        step.step_id !== stepId ||
        (step.type !== "set_value" &&
          step.type !== "increment_value" &&
          step.type !== "decrement_value")
      ) {
        return step;
      }
      if (slot === "primary") {
        if (source === null) {
          return step;
        }
        return step.type === "set_value" ? { ...step, value: source } : { ...step, amount: source };
      }
      return { ...step, [slot]: source };
    })
  };
}

export function updateBoundedMutationFormula(
  values: ActionEditorValues,
  stepId: string,
  slot: BoundedMutationSourceSlot,
  updates: {
    text?: string;
    aliases?: FormulaAlias[] | null;
    tags?: string[];
  }
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  return {
    ...nextValues,
    steps: nextValues.steps.map((step) => {
      if (
        step.step_id !== stepId ||
        (step.type !== "set_value" &&
          step.type !== "increment_value" &&
          step.type !== "decrement_value")
      ) {
        return step;
      }
      const source = boundedMutationSlotSource(step, slot);
      if (!source || !isInlineFormula(source)) {
        return step;
      }
      const updatedSource: EditorFormulaValue = {
        ...source,
        aliases: updates.aliases === undefined ? source.aliases : cloneAliases(updates.aliases),
        text: updates.text ?? source.text,
        ...(updates.tags === undefined ? {} : { tags: normalizeFormulaTags(updates.tags) })
      };
      if (slot === "primary") {
        return step.type === "set_value"
          ? { ...step, value: updatedSource }
          : { ...step, amount: updatedSource };
      }
      return { ...step, [slot]: updatedSource };
    })
  };
}

export function updateBoundedMutationSettings(
  values: ActionEditorValues,
  stepId: string,
  updates: {
    path?: string[];
    onMinViolation?: "clamp" | "reject";
    onMaxViolation?: "clamp" | "reject";
  }
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  return {
    ...nextValues,
    steps: nextValues.steps.map((step) =>
      step.step_id === stepId &&
      (step.type === "set_value" ||
        step.type === "increment_value" ||
        step.type === "decrement_value")
        ? {
            ...step,
            path: updates.path ? [...updates.path] : step.path,
            on_min_violation: updates.onMinViolation ?? step.on_min_violation,
            on_max_violation: updates.onMaxViolation ?? step.on_max_violation
          }
        : step
    )
  };
}

export function updateApplyAugmentationActionStep(
  values: ActionEditorValues,
  stepId: string,
  updates: {
    augmentationId?: string;
    operation?: "apply" | "remove";
  }
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  return {
    ...nextValues,
    steps: nextValues.steps.map((step) =>
      step.step_id === stepId && step.type === "apply_augmentation"
        ? {
            ...step,
            augmentation_id: updates.augmentationId ?? step.augmentation_id,
            operation: updates.operation ?? step.operation
          }
        : step
    )
  };
}

export function updateApplyConditionPresetActionStep(
  values: ActionEditorValues,
  stepId: string,
  updates: {
    conditionId?: string;
    operation?: "apply" | "remove";
  }
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  return {
    ...nextValues,
    steps: nextValues.steps.map((step) =>
      step.step_id === stepId && step.type === "apply_condition_preset"
        ? {
            ...step,
            condition_id: updates.conditionId ?? step.condition_id,
            operation: updates.operation ?? step.operation
          }
        : step
    )
  };
}

export function addGainProficiencyUseActionStep(
  values: ActionEditorValues,
  stepId: string,
  proficiencyId: string
): ActionEditorValues {
  return {
    ...values,
    steps: [
      ...cloneActionSteps(values.steps),
      createGainProficiencyUseActionStep(stepId, proficiencyId)
    ]
  };
}

export function updateSendMessageActionStepText(
  values: ActionEditorValues,
  stepId: string,
  messageText: string
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  return {
    ...nextValues,
    steps: nextValues.steps.map((step) =>
      step.step_id === stepId && step.type === "send_message"
        ? {
            ...step,
            message: isInlineFormula(step.message)
              ? {
                  ...step.message,
                  aliases: step.message.aliases,
                  text: messageText
                }
              : step.message
          }
        : step
    )
  };
}

export function updateSendMessageActionStepFormula(
  values: ActionEditorValues,
  stepId: string,
  updates: {
    messageText?: string;
    aliases?: FormulaAlias[] | null;
    tags?: string[];
  }
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  return {
    ...nextValues,
    steps: nextValues.steps.map((step) =>
      step.step_id === stepId && step.type === "send_message"
        ? {
            ...step,
            message: isInlineFormula(step.message)
              ? {
                  ...step.message,
                  aliases:
                    updates.aliases === undefined
                      ? step.message.aliases
                      : cloneAliases(updates.aliases),
                  text: updates.messageText ?? step.message.text,
                  ...(updates.tags === undefined
                    ? {}
                    : { tags: normalizeFormulaTags(updates.tags) })
                }
              : step.message
          }
        : step
    )
  };
}

export function updateResolveDamageActionStep(
  values: ActionEditorValues,
  stepId: string,
  updates: {
    damageType?: ResolveDamageEditorStep["damage_type"];
    amountText?: string;
  }
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  return {
    ...nextValues,
    steps: nextValues.steps.map((step) =>
      step.step_id === stepId && step.type === "resolve_damage"
        ? {
            ...step,
            damage_type: updates.damageType ?? step.damage_type,
            amount: isInlineFormula(step.amount)
              ? {
                  ...step.amount,
                  aliases: step.amount.aliases,
                  text: updates.amountText ?? step.amount.text
                }
              : step.amount
          }
        : step
    )
  };
}

export function updateResolveDamageActionStepFormula(
  values: ActionEditorValues,
  stepId: string,
  updates: {
    amountText?: string;
    aliases?: FormulaAlias[] | null;
    tags?: string[];
  }
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  return {
    ...nextValues,
    steps: nextValues.steps.map((step) =>
      step.step_id === stepId && step.type === "resolve_damage" && isInlineFormula(step.amount)
        ? {
            ...step,
            amount: {
              ...step.amount,
              aliases:
                updates.aliases === undefined ? step.amount.aliases : cloneAliases(updates.aliases),
              text: updates.amountText ?? step.amount.text,
              ...(updates.tags === undefined ? {} : { tags: normalizeFormulaTags(updates.tags) })
            }
          }
        : step
    )
  };
}

export function updateGainProficiencyUseActionStep(
  values: ActionEditorValues,
  stepId: string,
  updates: {
    proficiencyId?: string;
    amountText?: string;
  }
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  return {
    ...nextValues,
    steps: nextValues.steps.map((step) =>
      step.step_id === stepId && step.type === "gain_proficiency_use"
        ? {
            ...step,
            proficiency_id: updates.proficiencyId ?? step.proficiency_id,
            amount: isInlineFormula(step.amount)
              ? {
                  ...step.amount,
                  aliases: step.amount.aliases,
                  text: updates.amountText ?? step.amount.text
                }
              : step.amount
          }
        : step
    )
  };
}

export function updateGainProficiencyUseActionStepFormula(
  values: ActionEditorValues,
  stepId: string,
  updates: {
    amountText?: string;
    aliases?: FormulaAlias[] | null;
    tags?: string[];
  }
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  return {
    ...nextValues,
    steps: nextValues.steps.map((step) =>
      step.step_id === stepId &&
      step.type === "gain_proficiency_use" &&
      isInlineFormula(step.amount)
        ? {
            ...step,
            amount: {
              ...step.amount,
              aliases:
                updates.aliases === undefined ? step.amount.aliases : cloneAliases(updates.aliases),
              text: updates.amountText ?? step.amount.text,
              ...(updates.tags === undefined ? {} : { tags: normalizeFormulaTags(updates.tags) })
            }
          }
        : step
    )
  };
}

export function removeSendMessageActionStep(
  values: ActionEditorValues,
  stepId: string
): ActionEditorValues {
  return {
    ...values,
    steps: cloneActionSteps(values.steps).filter(
      (step) => step.step_id !== stepId || step.type !== "send_message"
    )
  };
}

export function removeCalculateValueActionStep(
  values: ActionEditorValues,
  stepId: string
): ActionEditorValues {
  return {
    ...values,
    steps: cloneActionSteps(values.steps).filter(
      (step) => step.step_id !== stepId || step.type !== "calculate_value"
    )
  };
}

export function moveActionStep(
  values: ActionEditorValues,
  stepId: string,
  direction: "up" | "down"
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  const currentIndex = nextValues.steps.findIndex((step) => step.step_id === stepId);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= nextValues.steps.length) {
    return nextValues;
  }
  [nextValues.steps[currentIndex], nextValues.steps[targetIndex]] = [
    nextValues.steps[targetIndex],
    nextValues.steps[currentIndex]
  ];
  return nextValues;
}

export function removeActionStep(values: ActionEditorValues, stepId: string): ActionEditorValues {
  return {
    ...values,
    steps: cloneActionSteps(values.steps).filter((step) => step.step_id !== stepId)
  };
}

export function duplicateActionStep(
  values: ActionEditorValues,
  stepId: string,
  duplicateStepId: string
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  const currentIndex = nextValues.steps.findIndex((step) => step.step_id === stepId);
  const currentStep = nextValues.steps[currentIndex];
  if (!currentStep) {
    return nextValues;
  }

  const duplicate = structuredClone(currentStep) as ActionEditorStep;
  duplicate.step_id = duplicateStepId;
  if (duplicate.type === "calculate_value") {
    const variableIds = new Set(
      nextValues.steps
        .filter((step) => step.type === "calculate_value")
        .map((step) => step.variable_id)
    );
    const baseVariableId = `${duplicate.variable_id}_copy`;
    let variableId = baseVariableId;
    let copyIndex = 2;
    while (variableIds.has(variableId)) {
      variableId = `${baseVariableId}_${copyIndex}`;
      copyIndex += 1;
    }
    duplicate.variable_id = variableId;
  }

  nextValues.steps.splice(currentIndex + 1, 0, duplicate);
  return nextValues;
}

export function setActionStepFormulaReference(
  values: ActionEditorValues,
  stepId: string,
  formulaId: string | null
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  const source: EditorFormulaValue | { type: "formula_reference"; formula_id: string } = formulaId
    ? { type: "formula_reference", formula_id: formulaId }
    : emptyFormulaValue();
  return {
    ...nextValues,
    steps: nextValues.steps.map((step) => {
      if (step.step_id !== stepId) {
        return step;
      }
      if (step.type === "send_message") {
        return { ...step, message: source };
      }
      if (step.type === "calculate_value") {
        return { ...step, value: source };
      }
      if (step.type === "set_value") {
        return { ...step, value: source };
      }
      if (
        step.type === "increment_value" ||
        step.type === "decrement_value" ||
        step.type === "resolve_damage" ||
        step.type === "gain_proficiency_use"
      ) {
        return { ...step, amount: source };
      }
      return step;
    })
  };
}

export function setNumericStepCalculatedValue(
  values: ActionEditorValues,
  stepId: string,
  variableId: string | null
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  return {
    ...nextValues,
    steps: nextValues.steps.map((step) => {
      if (
        step.step_id !== stepId ||
        (step.type !== "set_value" &&
          step.type !== "increment_value" &&
          step.type !== "decrement_value" &&
          step.type !== "resolve_damage" &&
          step.type !== "gain_proficiency_use")
      ) {
        return step;
      }
      const source = variableId
        ? ({ type: "calculated_value", variable_id: variableId } as const)
        : emptyFormulaValue();
      return step.type === "set_value" ? { ...step, value: source } : { ...step, amount: source };
    })
  };
}

export function removeResolveDamageActionStep(
  values: ActionEditorValues,
  stepId: string
): ActionEditorValues {
  return {
    ...values,
    steps: cloneActionSteps(values.steps).filter(
      (step) => step.step_id !== stepId || step.type !== "resolve_damage"
    )
  };
}

export function removeIncrementValueActionStep(
  values: ActionEditorValues,
  stepId: string
): ActionEditorValues {
  return {
    ...values,
    steps: cloneActionSteps(values.steps).filter(
      (step) => step.step_id !== stepId || step.type !== "increment_value"
    )
  };
}

export function removeGainProficiencyUseActionStep(
  values: ActionEditorValues,
  stepId: string
): ActionEditorValues {
  return {
    ...values,
    steps: cloneActionSteps(values.steps).filter(
      (step) => step.step_id !== stepId || step.type !== "gain_proficiency_use"
    )
  };
}

export function moveSendMessageActionStep(
  values: ActionEditorValues,
  stepId: string,
  direction: "up" | "down"
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  const messageSlots = nextValues.steps
    .map((step, index) => ({ step, index }))
    .filter(
      (entry): entry is { step: SendMessageEditorStep; index: number } =>
        entry.step.type === "send_message"
    );
  const currentMessageIndex = messageSlots.findIndex((entry) => entry.step.step_id === stepId);
  const targetMessageIndex = direction === "up" ? currentMessageIndex - 1 : currentMessageIndex + 1;

  if (
    currentMessageIndex < 0 ||
    targetMessageIndex < 0 ||
    targetMessageIndex >= messageSlots.length
  ) {
    return nextValues;
  }

  const currentSlot = messageSlots[currentMessageIndex];
  const targetSlot = messageSlots[targetMessageIndex];
  nextValues.steps[currentSlot.index] = targetSlot.step;
  nextValues.steps[targetSlot.index] = currentSlot.step;
  return nextValues;
}

export function moveResolveDamageActionStep(
  values: ActionEditorValues,
  stepId: string,
  direction: "up" | "down"
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  const damageSlots = nextValues.steps
    .map((step, index) => ({ step, index }))
    .filter(
      (entry): entry is { step: ResolveDamageEditorStep; index: number } =>
        entry.step.type === "resolve_damage"
    );
  const currentDamageIndex = damageSlots.findIndex((entry) => entry.step.step_id === stepId);
  const targetDamageIndex = direction === "up" ? currentDamageIndex - 1 : currentDamageIndex + 1;

  if (currentDamageIndex < 0 || targetDamageIndex < 0 || targetDamageIndex >= damageSlots.length) {
    return nextValues;
  }

  const currentSlot = damageSlots[currentDamageIndex];
  const targetSlot = damageSlots[targetDamageIndex];
  nextValues.steps[currentSlot.index] = targetSlot.step;
  nextValues.steps[targetSlot.index] = currentSlot.step;
  return nextValues;
}

export function moveGainProficiencyUseActionStep(
  values: ActionEditorValues,
  stepId: string,
  direction: "up" | "down"
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  const proficiencySlots = nextValues.steps
    .map((step, index) => ({ step, index }))
    .filter(
      (entry): entry is { step: GainProficiencyUseEditorStep; index: number } =>
        entry.step.type === "gain_proficiency_use"
    );
  const currentProficiencyIndex = proficiencySlots.findIndex(
    (entry) => entry.step.step_id === stepId
  );
  const targetProficiencyIndex =
    direction === "up" ? currentProficiencyIndex - 1 : currentProficiencyIndex + 1;

  if (
    currentProficiencyIndex < 0 ||
    targetProficiencyIndex < 0 ||
    targetProficiencyIndex >= proficiencySlots.length
  ) {
    return nextValues;
  }

  const currentSlot = proficiencySlots[currentProficiencyIndex];
  const targetSlot = proficiencySlots[targetProficiencyIndex];
  nextValues.steps[currentSlot.index] = targetSlot.step;
  nextValues.steps[targetSlot.index] = currentSlot.step;
  return nextValues;
}

export function toActionEditorValues(action: ActionDefinition): ActionEditorValues {
  return {
    name: action.name,
    rollModeKind: action.roll_mode_kind ?? "none",
    notes: action.notes ?? "",
    steps: cloneActionSteps(action.steps),
    facts: structuredClone(action.facts ?? {})
  };
}

export function toActionDefinitionPayload(
  values: ActionEditorValues,
  actionId: string
): ActionDefinitionPayload {
  return {
    id: actionId,
    name: values.name.trim(),
    roll_mode_kind: values.rollModeKind,
    notes: values.notes.trim(),
    steps: cloneActionSteps(values.steps),
    facts: structuredClone(values.facts)
  };
}

export function toUpdatedActionDefinitionPayload(
  action: ActionDefinition,
  values: ActionEditorValues
): ActionDefinitionPayload {
  return {
    id: action.id,
    name: values.name.trim(),
    roll_mode_kind: values.rollModeKind,
    notes: values.notes.trim(),
    steps: cloneActionSteps(values.steps),
    facts: structuredClone(values.facts)
  };
}
