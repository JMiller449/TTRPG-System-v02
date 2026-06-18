import type { ActionDefinition } from "@/domain/models";
import type { ActionDefinitionPayload } from "@/infrastructure/ws/requestBuilders";

export type ActionEditorSteps = NonNullable<ActionDefinitionPayload["steps"]>;
export type ActionEditorStep = ActionEditorSteps[number];
export type SendMessageEditorStep = Extract<ActionEditorStep, { type: "send_message" }>;

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

export function addSendMessageActionStep(
  values: ActionEditorValues,
  stepId: string
): ActionEditorValues {
  return {
    ...values,
    steps: [...cloneActionSteps(values.steps), createSendMessageActionStep(stepId)]
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

export function removeSendMessageActionStep(
  values: ActionEditorValues,
  stepId: string
): ActionEditorValues {
  return {
    ...values,
    steps: cloneActionSteps(values.steps).filter((step) => step.step_id !== stepId || step.type !== "send_message")
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
