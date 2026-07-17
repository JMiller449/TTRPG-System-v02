import {
  addApplyAugmentationActionStep,
  addApplyConditionPresetActionStep,
  addCalculateValueActionStep,
  addDecrementValueActionStep,
  addGainProficiencyUseActionStep,
  addIncrementValueActionStep,
  addResolveDamageActionStep,
  addSendMessageActionStep,
  addSendRollActionStep,
  addSetValueActionStep,
  type ActionEditorStep,
  type ActionEditorValues
} from "@/features/actions/actionEditorValues";

export type ActionStepMenuType = ActionEditorStep["type"];
export type ActionStepMenuGroup = "Calculation & Output" | "State Changes" | "Rules & Effects";

export interface ActionStepMenuOption {
  type: ActionStepMenuType;
  label: string;
  group: ActionStepMenuGroup;
  unavailableReason: string | null;
}

export interface ActionStepMenuDependencies {
  mutationTargetPath?: string[];
  proficiencyId?: string;
  augmentationId?: string;
  conditionId?: string;
}

const STEP_DEFINITIONS: ReadonlyArray<Omit<ActionStepMenuOption, "unavailableReason">> = [
  { type: "calculate_value", label: "Calculate value", group: "Calculation & Output" },
  { type: "send_message", label: "Send Roll20 message", group: "Calculation & Output" },
  { type: "send_roll", label: "Send styled Roll20 roll", group: "Calculation & Output" },
  { type: "set_value", label: "Set sheet value", group: "State Changes" },
  { type: "increment_value", label: "Increase sheet value", group: "State Changes" },
  { type: "decrement_value", label: "Decrease sheet value", group: "State Changes" },
  { type: "resolve_damage", label: "Resolve damage", group: "Rules & Effects" },
  { type: "gain_proficiency_use", label: "Gain proficiency use", group: "Rules & Effects" },
  { type: "apply_augmentation", label: "Apply or remove effect", group: "Rules & Effects" },
  {
    type: "apply_condition_preset",
    label: "Apply or remove condition",
    group: "Rules & Effects"
  }
];

export function actionStepLabel(type: ActionStepMenuType): string {
  return STEP_DEFINITIONS.find((definition) => definition.type === type)?.label ?? type;
}

export function actionStepIdPrefix(type: ActionStepMenuType): string {
  switch (type) {
    case "calculate_value":
      return "calculate";
    case "send_message":
      return "message";
    case "send_roll":
      return "roll";
    case "set_value":
      return "set";
    case "increment_value":
      return "increase";
    case "decrement_value":
      return "decrease";
    case "resolve_damage":
      return "damage";
    case "gain_proficiency_use":
      return "proficiency";
    case "apply_augmentation":
      return "effect";
    case "apply_condition_preset":
      return "condition";
  }
}

function unavailableReason(
  type: ActionStepMenuType,
  dependencies: ActionStepMenuDependencies
): string | null {
  if (
    (type === "set_value" || type === "increment_value" || type === "decrement_value") &&
    !dependencies.mutationTargetPath
  ) {
    return "no editable instance values available";
  }
  if (type === "gain_proficiency_use" && !dependencies.proficiencyId) {
    return "no proficiencies authored";
  }
  if (type === "apply_augmentation" && !dependencies.augmentationId) {
    return "no standalone effects authored";
  }
  if (type === "apply_condition_preset" && !dependencies.conditionId) {
    return "no conditions authored";
  }
  return null;
}

export function buildActionStepMenuOptions(
  dependencies: ActionStepMenuDependencies
): ActionStepMenuOption[] {
  return STEP_DEFINITIONS.map((definition) => ({
    ...definition,
    unavailableReason: unavailableReason(definition.type, dependencies)
  }));
}

function nextCalculatedVariableId(values: ActionEditorValues): string {
  const existingVariables = new Set(
    values.steps.filter((step) => step.type === "calculate_value").map((step) => step.variable_id)
  );
  let variableIndex = existingVariables.size + 1;
  while (existingVariables.has(`value_${variableIndex}`)) {
    variableIndex += 1;
  }
  return `value_${variableIndex}`;
}

export function addActionStepFromMenu({
  values,
  type,
  stepId,
  dependencies
}: {
  values: ActionEditorValues;
  type: ActionStepMenuType;
  stepId: string;
  dependencies: ActionStepMenuDependencies;
}): ActionEditorValues | null {
  if (unavailableReason(type, dependencies)) {
    return null;
  }
  switch (type) {
    case "calculate_value":
      return addCalculateValueActionStep(values, stepId, nextCalculatedVariableId(values));
    case "send_message":
      return addSendMessageActionStep(values, stepId);
    case "send_roll":
      return addSendRollActionStep(values, stepId);
    case "set_value":
      return addSetValueActionStep(values, stepId, dependencies.mutationTargetPath ?? []);
    case "increment_value":
      return addIncrementValueActionStep(values, stepId, dependencies.mutationTargetPath ?? []);
    case "decrement_value":
      return addDecrementValueActionStep(values, stepId, dependencies.mutationTargetPath ?? []);
    case "resolve_damage":
      return addResolveDamageActionStep(values, stepId);
    case "gain_proficiency_use":
      return addGainProficiencyUseActionStep(values, stepId, dependencies.proficiencyId ?? "");
    case "apply_augmentation":
      return addApplyAugmentationActionStep(values, stepId, dependencies.augmentationId ?? "");
    case "apply_condition_preset":
      return addApplyConditionPresetActionStep(values, stepId, dependencies.conditionId ?? "");
  }
}
