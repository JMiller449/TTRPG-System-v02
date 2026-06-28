import type {
  Augmentation,
  AugmentationEffectType,
  AugmentationOperation,
  FormulaAlias,
  RollModeModifier
} from "@/domain/models";
import { normalizeFormulaTags } from "@/features/formulas/formulaTags";
import type { AugmentationTargetMetadata } from "@/domain/ipc";
import type { AugmentationPayload } from "@/infrastructure/ws/requestBuilders";

export type ItemAugmentationTargetRoot = "sheet" | "instance";
export type AugmentationTargetOption = AugmentationTargetMetadata["targets"][number];

export interface AugmentationEditorValues {
  name: string;
  description: string;
  active: boolean;
  targetRoot: ItemAugmentationTargetRoot;
  targetPath: string[];
  effectType: AugmentationEffectType;
  operation: AugmentationOperation;
  rollMode: RollModeModifier;
  formulaText: string;
  formulaAliases: FormulaAlias[] | null;
  selectorRequiredTags: string[];
  selectorExcludedTags: string[];
  selectorActionId: string;
  selectorFormulaId: string;
  selectorStepId: string;
  duration: string;
  expiresAt: string;
  removalCondition: string;
}

export function createEmptyAugmentationEditorValues(): AugmentationEditorValues {
  return {
    name: "",
    description: "",
    active: true,
    targetRoot: "instance",
    targetPath: [],
    effectType: "formula_modifier",
    operation: "add",
    rollMode: "advantage",
    formulaText: "",
    formulaAliases: null,
    selectorRequiredTags: [],
    selectorExcludedTags: [],
    selectorActionId: "",
    selectorFormulaId: "",
    selectorStepId: "",
    duration: "",
    expiresAt: "",
    removalCondition: ""
  };
}

function cloneAliases(aliases: FormulaAlias[] | null | undefined): FormulaAlias[] | null {
  return aliases?.map((alias) => ({ ...alias, path: [...alias.path] })) ?? null;
}

function cleanPath(path: string[]): string[] {
  return path.map((segment) => segment.trim()).filter(Boolean);
}

function pathsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index]);
}

function targetKey(root: string, path: string[]): string {
  return `${root}.${path.join(".")}`;
}

export function augmentationTargetOptionKey(target: AugmentationTargetOption): string {
  return targetKey(target.root, target.path);
}

export function augmentationEditorTargetKey(values: AugmentationEditorValues): string {
  return targetKey(values.targetRoot, cleanPath(values.targetPath));
}

export function formatAugmentationTargetOption(target: AugmentationTargetOption): string {
  return `${target.label} (${target.key})`;
}

export function formatFormulaModifierSelector(augmentation: Augmentation): string {
  const selector = augmentation.effect.selector;
  if (!selector) {
    return "all formulas";
  }
  const constraints = [
    ...(selector.required_tags?.length ? [`requires ${selector.required_tags.join(" + ")}`] : []),
    ...(selector.excluded_tags?.length ? [`excludes ${selector.excluded_tags.join(" + ")}`] : []),
    ...(selector.action_id ? [`action ${selector.action_id}`] : []),
    ...(selector.formula_id ? [`formula ${selector.formula_id}`] : []),
    ...(selector.step_id ? [`step ${selector.step_id}`] : [])
  ];
  return constraints.length > 0 ? constraints.join("; ") : "all formulas";
}

export function formatAugmentationEffect(augmentation: Augmentation): string {
  if (augmentation.effect.type === "roll_mode_modifier") {
    return `grant ${augmentation.effect.roll_mode}`;
  }
  const prefix =
    augmentation.effect.type === "evaluation_formula_modifier" ? "evaluate" : "mutate";
  return `${prefix}: ${augmentation.effect.operation} ${augmentation.effect.value.text || "(blank)"}`;
}

export function isKnownAugmentationEditorTarget(
  values: AugmentationEditorValues,
  targets: AugmentationTargetOption[]
): boolean {
  const path = cleanPath(values.targetPath);
  return targets.some(
    (target) => target.root === values.targetRoot && pathsEqual(target.path, path)
  );
}

export function applyAugmentationTargetOption(
  values: AugmentationEditorValues,
  target: AugmentationTargetOption
): AugmentationEditorValues {
  if (target.root !== "sheet" && target.root !== "instance") {
    return values;
  }

  return {
    ...values,
    targetRoot: target.root,
    targetPath: [...target.path]
  };
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readItemTargetRoot(augmentation: Augmentation): ItemAugmentationTargetRoot {
  if (augmentation.target.root === "sheet" || augmentation.target.root === "instance") {
    return augmentation.target.root;
  }
  return augmentation.scope === "sheet" ? "sheet" : "instance";
}

export function toAugmentationEditorValues(augmentation: Augmentation): AugmentationEditorValues {
  const numericEffect =
    augmentation.effect.type === "roll_mode_modifier" ? null : augmentation.effect;
  return {
    name: augmentation.name,
    description: augmentation.description ?? "",
    active: augmentation.active ?? true,
    targetRoot: readItemTargetRoot(augmentation),
    targetPath: [...augmentation.target.path],
    effectType: augmentation.effect.type,
    operation: numericEffect?.operation ?? "add",
    rollMode:
      augmentation.effect.type === "roll_mode_modifier"
        ? augmentation.effect.roll_mode
        : "advantage",
    formulaText: numericEffect?.value.text ?? "",
    formulaAliases: cloneAliases(numericEffect?.value.aliases),
    selectorRequiredTags: normalizeFormulaTags(augmentation.effect.selector?.required_tags ?? []),
    selectorExcludedTags: normalizeFormulaTags(augmentation.effect.selector?.excluded_tags ?? []),
    selectorActionId: augmentation.effect.selector?.action_id ?? "",
    selectorFormulaId: augmentation.effect.selector?.formula_id ?? "",
    selectorStepId: augmentation.effect.selector?.step_id ?? "",
    duration: augmentation.lifecycle?.duration ?? "",
    expiresAt: augmentation.lifecycle?.expires_at ?? "",
    removalCondition: augmentation.lifecycle?.removal_condition ?? ""
  };
}

export function hasValidAugmentationEditorValues(values: AugmentationEditorValues): boolean {
  const requiredTags = new Set(normalizeFormulaTags(values.selectorRequiredTags));
  const hasSelectorConflict = normalizeFormulaTags(values.selectorExcludedTags).some((tag) =>
    requiredTags.has(tag)
  );
  return (
    values.name.trim().length > 0 &&
    (values.effectType === "roll_mode_modifier" || values.formulaText.trim().length > 0) &&
    cleanPath(values.targetPath).length > 0 &&
    !hasSelectorConflict
  );
}

export function toAugmentationEffectPayload(
  values: AugmentationEditorValues
): AugmentationPayload["effect"] {
  const selector = {
    required_tags: normalizeFormulaTags(values.selectorRequiredTags),
    excluded_tags: normalizeFormulaTags(values.selectorExcludedTags),
    action_id: optionalText(values.selectorActionId),
    formula_id: optionalText(values.selectorFormulaId),
    step_id: optionalText(values.selectorStepId)
  };

  if (values.effectType === "roll_mode_modifier") {
    return {
      roll_mode: values.rollMode,
      selector,
      type: "roll_mode_modifier"
    };
  }

  return {
    operation: values.operation,
    value: {
      aliases: cloneAliases(values.formulaAliases),
      text: values.formulaText.trim()
    },
    selector,
    type: values.effectType
  };
}

export function toItemAugmentationTemplatePayload({
  values,
  augmentationId,
  itemId,
  itemName
}: {
  values: AugmentationEditorValues;
  augmentationId: string;
  itemId: string;
  itemName: string;
}): AugmentationPayload {
  return {
    id: augmentationId,
    name: values.name.trim(),
    description: values.description.trim(),
    source: {
      type: "item",
      id: itemId,
      label: itemName.trim() || null
    },
    scope: values.targetRoot,
    target: {
      root: values.targetRoot,
      path: cleanPath(values.targetPath)
    },
    effect: toAugmentationEffectPayload(values),
    active: values.active,
    applied: false,
    applied_target_id: null,
    lifecycle: {
      duration: optionalText(values.duration),
      expires_at: optionalText(values.expiresAt),
      removal_condition: optionalText(values.removalCondition)
    }
  };
}
