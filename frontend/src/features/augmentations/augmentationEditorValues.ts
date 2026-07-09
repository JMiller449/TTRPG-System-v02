import type {
  Augmentation,
  AugmentationEffectType,
  AugmentationOperation,
  FormulaAlias,
  LifecycleMode,
  RollModeModifier,
  StandaloneEffectDefinition
} from "@/domain/models";
import { normalizeFormulaTags } from "@/features/formulas/formulaTags";
import type { AugmentationTargetMetadata } from "@/domain/ipc";
import type { AugmentationPayload } from "@/infrastructure/ws/requestBuilders";

export type ItemAugmentationTargetRoot = "sheet" | "instance";

export const LIFECYCLE_MODE_OPTIONS: { value: LifecycleMode; label: string }[] = [
  { value: "manual", label: "Manual (GM removes)" },
  { value: "rounds", label: "Rounds" },
  { value: "turns", label: "Turns" },
  { value: "until_rest", label: "Until rest" },
  { value: "until_source_removed", label: "Until source removed" },
  { value: "scene", label: "Scene" }
];
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
  selectorSameSourceItem: boolean;
  lifecycleMode: LifecycleMode;
  lifecycleRemaining: string;
  expiresAt: string;
  removeWhenSourceInactive: boolean;
  lifecycleNotes: string;
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
    selectorSameSourceItem: false,
    lifecycleMode: "manual",
    lifecycleRemaining: "",
    expiresAt: "",
    removeWhenSourceInactive: false,
    lifecycleNotes: ""
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

type EffectDefinitionLike = Pick<
  Augmentation | StandaloneEffectDefinition,
  "effect" | "scope" | "target"
>;

export function formatFormulaModifierSelector(
  augmentation: Pick<EffectDefinitionLike, "effect">
): string {
  const selector = augmentation.effect.selector;
  if (!selector) {
    return "all formulas";
  }
  const constraints = [
    ...(selector.required_tags?.length ? [`tags ${selector.required_tags.join(" + ")}`] : []),
    ...(selector.excluded_tags?.length ? [`not ${selector.excluded_tags.join(" + ")}`] : []),
    ...(selector.action_id ? [`action: ${selector.action_id}`] : []),
    ...(selector.formula_id ? [`formula: ${selector.formula_id}`] : []),
    ...(selector.step_id ? [`step: ${selector.step_id}`] : []),
    ...(selector.same_source_item ? ["same source item only"] : [])
  ];
  return constraints.length > 0 ? constraints.join("; ") : "all matching formulas";
}

function operationLabel(operation: AugmentationOperation, value: string): string {
  const labels: Record<AugmentationOperation, string> = {
    add: `Add ${value}`,
    subtract: `Subtract ${value}`,
    multiply: `Multiply by ${value}`,
    divide: `Divide by ${value}`,
    set: `Set to ${value}`
  };
  return labels[operation];
}

export function augmentationEffectUsesTarget(
  augmentation: Pick<EffectDefinitionLike, "effect">
): boolean {
  return augmentation.effect.type === "formula_modifier";
}

export function formatAugmentationEffect(
  augmentation: Pick<EffectDefinitionLike, "effect">
): string {
  if (augmentation.effect.type === "roll_mode_modifier") {
    const rollMode = augmentation.effect.roll_mode === "advantage" ? "Advantage" : "Disadvantage";
    return `${rollMode} on matching rolls`;
  }
  const value = augmentation.effect.value.text || "(blank)";
  const operation = operationLabel(augmentation.effect.operation, value);
  return augmentation.effect.type === "evaluation_formula_modifier"
    ? `${operation} to matching formula results`
    : `${operation} to the target value`;
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

function optionalRemaining(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toAugmentationLifecyclePayload(
  values: AugmentationEditorValues
): AugmentationPayload["lifecycle"] {
  return {
    mode: values.lifecycleMode,
    remaining: optionalRemaining(values.lifecycleRemaining),
    expires_at: optionalText(values.expiresAt),
    remove_when_source_inactive: values.removeWhenSourceInactive,
    notes: optionalText(values.lifecycleNotes)
  };
}

function readItemTargetRoot(augmentation: EffectDefinitionLike): ItemAugmentationTargetRoot {
  if (augmentation.target.root === "sheet" || augmentation.target.root === "instance") {
    return augmentation.target.root;
  }
  return augmentation.scope === "sheet" ? "sheet" : "instance";
}

export function toAugmentationEditorValues(
  augmentation: EffectDefinitionLike & {
    name: string;
    description?: string;
    active?: boolean;
    lifecycle?: Augmentation["lifecycle"];
  }
): AugmentationEditorValues {
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
    selectorSameSourceItem: augmentation.effect.selector?.same_source_item ?? false,
    lifecycleMode: augmentation.lifecycle?.mode ?? "manual",
    lifecycleRemaining:
      augmentation.lifecycle?.remaining != null
        ? String(augmentation.lifecycle.remaining)
        : "",
    expiresAt: augmentation.lifecycle?.expires_at ?? "",
    removeWhenSourceInactive:
      augmentation.lifecycle?.remove_when_source_inactive ?? false,
    lifecycleNotes: augmentation.lifecycle?.notes ?? ""
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
    step_id: optionalText(values.selectorStepId),
    same_source_item: values.selectorSameSourceItem
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
}): Augmentation {
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
    lifecycle: toAugmentationLifecyclePayload(values)
  };
}
