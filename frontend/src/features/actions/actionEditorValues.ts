import type { ActionDefinition, FormulaAlias } from "@/domain/models";
import { normalizeFormulaTags } from "@/features/formulas/formulaTags";
import type { ActionDefinitionPayload } from "@/infrastructure/ws/requestBuilders";

export type ActionEditorSteps = NonNullable<ActionDefinitionPayload["steps"]>;
export type ActionEditorStep = ActionEditorSteps[number];
export type SendMessageEditorStep = Extract<ActionEditorStep, { type: "send_message" }>;
export type CalculateValueEditorStep = Extract<ActionEditorStep, { type: "calculate_value" }>;
export type ResolveDamageEditorStep = Extract<ActionEditorStep, { type: "resolve_damage" }>;
export type IncrementValueEditorStep = Extract<ActionEditorStep, { type: "increment_value" }>;
export type GainProficiencyUseEditorStep = Extract<
  ActionEditorStep,
  { type: "gain_proficiency_use" }
>;

export interface ActionEditorValues {
  name: string;
  notes: string;
  steps: ActionEditorSteps;
}

export function createEmptyActionEditorValues(): ActionEditorValues {
  return {
    name: "",
    notes: "",
    steps: []
  };
}

type EditorNumericValueSource = ResolveDamageEditorStep["amount"];
type EditorFormulaValue = Exclude<EditorNumericValueSource, { type: "calculated_value" }>;

export function isCalculatedValueReference(
  value: EditorNumericValueSource
): value is Extract<EditorNumericValueSource, { type: "calculated_value" }> {
  return "type" in value && value.type === "calculated_value";
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
    steps: cloneActionSteps(values.steps)
  };
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
    steps: [
      ...cloneActionSteps(values.steps),
      createCalculateValueActionStep(stepId, variableId)
    ]
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
            value: {
              ...step.value,
              aliases:
                updates.aliases === undefined
                  ? step.value.aliases
                  : cloneAliases(updates.aliases),
              text: updates.formulaText ?? step.value.text,
              ...(updates.tags === undefined ? {} : { tags: normalizeFormulaTags(updates.tags) })
            }
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
    steps: [
      ...cloneActionSteps(values.steps),
      createIncrementValueActionStep(stepId, path)
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
      if (isCalculatedValueReference(step.amount)) {
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
            message: {
              ...step.message,
              aliases: step.message.aliases,
              text: messageText
            }
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
            message: {
              ...step.message,
              aliases:
                updates.aliases === undefined
                  ? step.message.aliases
                  : cloneAliases(updates.aliases),
              text: updates.messageText ?? step.message.text,
              ...(updates.tags === undefined ? {} : { tags: normalizeFormulaTags(updates.tags) })
            }
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
      step.step_id === stepId &&
      step.type === "resolve_damage" &&
      !isCalculatedValueReference(step.amount)
        ? {
            ...step,
            damage_type: updates.damageType ?? step.damage_type,
            amount: {
              ...step.amount,
              aliases: step.amount.aliases,
              text: updates.amountText ?? step.amount.text
            }
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
      step.step_id === stepId &&
      step.type === "resolve_damage" &&
      !isCalculatedValueReference(step.amount)
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
      step.step_id === stepId &&
      step.type === "gain_proficiency_use" &&
      !isCalculatedValueReference(step.amount)
        ? {
            ...step,
            proficiency_id: updates.proficiencyId ?? step.proficiency_id,
            amount: {
              ...step.amount,
              aliases: step.amount.aliases,
              text: updates.amountText ?? step.amount.text
            }
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
      !isCalculatedValueReference(step.amount)
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
        (step.type !== "increment_value" &&
          step.type !== "resolve_damage" &&
          step.type !== "gain_proficiency_use")
      ) {
        return step;
      }
      return {
        ...step,
        amount: variableId
          ? { type: "calculated_value", variable_id: variableId }
          : emptyFormulaValue()
      };
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
    notes: action.notes ?? "",
    steps: cloneActionSteps(action.steps)
  };
}

export function toActionDefinitionPayload(
  values: ActionEditorValues,
  actionId: string
): ActionDefinitionPayload {
  return {
    id: actionId,
    name: values.name.trim(),
    notes: values.notes.trim(),
    steps: cloneActionSteps(values.steps)
  };
}

export function toUpdatedActionDefinitionPayload(
  action: ActionDefinition,
  values: ActionEditorValues
): ActionDefinitionPayload {
  return {
    id: action.id,
    name: values.name.trim(),
    notes: values.notes.trim(),
    steps: cloneActionSteps(values.steps)
  };
}
