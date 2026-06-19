import type {
  Augmentation,
  AugmentationOperation,
  FormulaAlias
} from "@/domain/models";
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
  operation: AugmentationOperation;
  formulaText: string;
  formulaAliases: FormulaAlias[] | null;
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
    operation: "add",
    formulaText: "",
    formulaAliases: null,
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
  return {
    name: augmentation.name,
    description: augmentation.description ?? "",
    active: augmentation.active ?? true,
    targetRoot: readItemTargetRoot(augmentation),
    targetPath: [...augmentation.target.path],
    operation: augmentation.effect.operation,
    formulaText: augmentation.effect.value.text,
    formulaAliases: cloneAliases(augmentation.effect.value.aliases),
    duration: augmentation.lifecycle?.duration ?? "",
    expiresAt: augmentation.lifecycle?.expires_at ?? "",
    removalCondition: augmentation.lifecycle?.removal_condition ?? ""
  };
}

export function hasValidAugmentationEditorValues(values: AugmentationEditorValues): boolean {
  return (
    values.name.trim().length > 0 &&
    values.formulaText.trim().length > 0 &&
    cleanPath(values.targetPath).length > 0
  );
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
    effect: {
      operation: values.operation,
      value: {
        aliases: cloneAliases(values.formulaAliases),
        text: values.formulaText.trim()
      },
      type: "formula_modifier"
    },
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
