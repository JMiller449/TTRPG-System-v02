import type { ActionDefinition, FormulaAlias } from "@/domain/models";
import type { ActionDefinitionPayload } from "@/infrastructure/ws/requestBuilders";

export type ActionEditorSteps = NonNullable<ActionDefinitionPayload["steps"]>;
export type ActionEditorStep = ActionEditorSteps[number];
export type SendMessageEditorStep = Extract<ActionEditorStep, { type: "send_message" }>;
export type ResolveDamageEditorStep = Extract<ActionEditorStep, { type: "resolve_damage" }>;

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

export function addSendMessageActionStep(
  values: ActionEditorValues,
  stepId: string
): ActionEditorValues {
  return {
    ...values,
    steps: [...cloneActionSteps(values.steps), createSendMessageActionStep(stepId)]
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
              aliases: updates.aliases === undefined ? step.message.aliases : cloneAliases(updates.aliases),
              text: updates.messageText ?? step.message.text
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
      step.step_id === stepId && step.type === "resolve_damage"
        ? {
            ...step,
            damage_type: updates.damageType ?? step.damage_type,
            amount: {
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
  }
): ActionEditorValues {
  const nextValues = cloneActionEditorValues(values);
  return {
    ...nextValues,
    steps: nextValues.steps.map((step) =>
      step.step_id === stepId && step.type === "resolve_damage"
        ? {
            ...step,
            amount: {
              aliases: updates.aliases === undefined ? step.amount.aliases : cloneAliases(updates.aliases),
              text: updates.amountText ?? step.amount.text
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
    steps: cloneActionSteps(values.steps).filter((step) => step.step_id !== stepId || step.type !== "send_message")
  };
}

export function removeResolveDamageActionStep(
  values: ActionEditorValues,
  stepId: string
): ActionEditorValues {
  return {
    ...values,
    steps: cloneActionSteps(values.steps).filter((step) => step.step_id !== stepId || step.type !== "resolve_damage")
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
    .filter((entry): entry is { step: SendMessageEditorStep; index: number } => entry.step.type === "send_message");
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
    .filter((entry): entry is { step: ResolveDamageEditorStep; index: number } => entry.step.type === "resolve_damage");
  const currentDamageIndex = damageSlots.findIndex((entry) => entry.step.step_id === stepId);
  const targetDamageIndex = direction === "up" ? currentDamageIndex - 1 : currentDamageIndex + 1;

  if (
    currentDamageIndex < 0 ||
    targetDamageIndex < 0 ||
    targetDamageIndex >= damageSlots.length
  ) {
    return nextValues;
  }

  const currentSlot = damageSlots[currentDamageIndex];
  const targetSlot = damageSlots[targetDamageIndex];
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
