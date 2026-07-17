import type {
  ActionDefinition,
  ActionStep,
  Formula,
  FormulaDefinition,
  FormulaValueSource,
  NumericValueSource
} from "@/domain/models";
import { COMMON_FORMULA_TAGS, normalizeFormulaTags } from "@/features/formulas/formulaTags";

export interface AugmentationSelectorIdOption {
  id: string;
  label: string;
}

export interface AugmentationSelectorStepOption extends AugmentationSelectorIdOption {
  actionId: string;
}

export interface AugmentationSelectorOptions {
  tags: string[];
  actions: AugmentationSelectorIdOption[];
  formulas: AugmentationSelectorIdOption[];
  steps: AugmentationSelectorStepOption[];
}

function numericSourceFormula(source: NumericValueSource | null | undefined): Formula | null {
  if (!source || "type" in source) {
    return null;
  }
  return source;
}

function formulaSourceFormula(source: FormulaValueSource): Formula | null {
  return "type" in source ? null : source;
}

function stepFormulas(step: ActionStep): Array<Formula | null | undefined> {
  switch (step.type) {
    case "send_message":
      return [formulaSourceFormula(step.message)];
    case "send_roll":
      return step.rolls.map((roll) => formulaSourceFormula(roll.value));
    case "calculate_value":
      return [formulaSourceFormula(step.value)];
    case "set_value":
      return [
        numericSourceFormula(step.value),
        numericSourceFormula(step.min_value),
        numericSourceFormula(step.max_value)
      ];
    case "increment_value":
    case "decrement_value":
      return [
        numericSourceFormula(step.amount),
        numericSourceFormula(step.min_value),
        numericSourceFormula(step.max_value)
      ];
    case "resolve_damage":
    case "gain_proficiency_use":
      return [numericSourceFormula(step.amount)];
    case "apply_augmentation":
    case "apply_condition_preset":
      return [];
  }
}

export function buildAugmentationSelectorOptions({
  actionRecords,
  actionOrder,
  formulaRecords,
  formulaOrder
}: {
  actionRecords: Record<string, ActionDefinition>;
  actionOrder: string[];
  formulaRecords: Record<string, FormulaDefinition>;
  formulaOrder: string[];
}): AugmentationSelectorOptions {
  const actions = actionOrder
    .map((id) => actionRecords[id])
    .filter((action): action is ActionDefinition => Boolean(action));
  const formulas = formulaOrder
    .map((id) => formulaRecords[id])
    .filter((formula): formula is FormulaDefinition => Boolean(formula));
  const steps = actions.flatMap((action) =>
    (action.steps ?? []).map((step) => ({
      id: step.step_id,
      actionId: action.id,
      label: `${action.name}: ${step.step_id} (${step.type})`
    }))
  );
  const discoveredTags = [
    ...formulas.flatMap((formula) => formula.formula.tags ?? []),
    ...actions.flatMap((action) =>
      (action.steps ?? []).flatMap((step) =>
        stepFormulas(step).flatMap((formula) => formula?.tags ?? [])
      )
    )
  ];

  return {
    tags: normalizeFormulaTags([...COMMON_FORMULA_TAGS, ...discoveredTags]),
    actions: actions.map((action) => ({ id: action.id, label: `${action.name} (${action.id})` })),
    formulas: formulas.map((formula) => ({ id: formula.id, label: formula.id })),
    steps
  };
}
