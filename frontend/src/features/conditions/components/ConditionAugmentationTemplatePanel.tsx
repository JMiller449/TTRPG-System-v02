import type {
  Augmentation,
  AugmentationOperation,
  LifecycleMode
} from "@/domain/models";
import { Field } from "@/shared/ui/Field";
import {
  applyAugmentationTargetOption,
  augmentationEffectUsesTarget,
  augmentationEditorTargetKey,
  augmentationTargetOptionKey,
  describeAugmentationEffectType,
  formatAugmentationEffect,
  formatFormulaModifierSelector,
  formatAugmentationTargetOption,
  hasValidAugmentationEditorValues,
  isKnownAugmentationEditorTarget,
  LIFECYCLE_MODE_OPTIONS,
  type AugmentationEditorValues,
  type AugmentationTargetOption
} from "@/features/augmentations/augmentationEditorValues";
import type { AugmentationSelectorOptions } from "@/features/augmentations/augmentationSelectorOptions";
import { FormulaModifierSelectorEditor } from "@/features/augmentations/components/FormulaModifierSelectorEditor";

const AUGMENTATION_OPERATIONS: readonly AugmentationOperation[] = [
  "add",
  "subtract",
  "multiply",
  "divide",
  "set"
];
const EFFECT_TYPES = [
  ["formula_modifier", "Direct sheet value"],
  ["evaluation_formula_modifier", "Matching formula value"],
  ["roll_mode_modifier", "Matching roll mode"]
] as const;

function formatTarget(augmentation: Augmentation): string {
  const path = augmentation.target.path.length > 0 ? augmentation.target.path.join(".") : "(none)";
  return `${augmentation.target.root}.${path}`;
}

function getEffectValidationError(
  values: AugmentationEditorValues,
  targetOptions: AugmentationTargetOption[]
): string | null {
  if (!values.name.trim()) {
    return "Effect name is required.";
  }
  if (targetOptions.length === 0) {
    return "Effect targets are unavailable.";
  }
  if (!isKnownAugmentationEditorTarget(values, targetOptions)) {
    return "Select an effect target.";
  }
  if (values.effectType !== "roll_mode_modifier" && !values.formulaText.trim()) {
    return "Formula is required.";
  }
  if (!hasValidAugmentationEditorValues(values)) {
    return "Required and excluded selector tags cannot overlap.";
  }
  return null;
}

export function ConditionAugmentationTemplatePanel({
  conditionName,
  editorOpen,
  editingAugmentationId,
  templates,
  targetOptions,
  selectorOptions,
  values,
  onChange,
  onAdd,
  onSubmit,
  onCancel,
  onEdit,
  onRemove
}: {
  conditionName: string;
  editorOpen: boolean;
  editingAugmentationId: string | null;
  templates: Augmentation[];
  targetOptions: AugmentationTargetOption[];
  selectorOptions: AugmentationSelectorOptions;
  values: AugmentationEditorValues;
  onChange: (values: AugmentationEditorValues) => void;
  onAdd: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  onEdit: (augmentation: Augmentation) => void;
  onRemove: (augmentationId: string) => void;
}): JSX.Element {
  const selectedTargetKey = augmentationEditorTargetKey(values);
  const hasCurrentTargetPath = values.targetPath.some((segment) => segment.trim().length > 0);
  const targetIsKnown = isKnownAugmentationEditorTarget(values, targetOptions);
  const validationError = getEffectValidationError(values, targetOptions);

  return (
    <section className="condition-effects-section stack">
      <div className="item-section-heading">
        <div>
          <h3>Effects</h3>
          <span className="muted">
            {conditionName} · {templates.length}
          </span>
        </div>
        {!editorOpen ? (
          <button className="button button--secondary" type="button" onClick={onAdd}>
            Add Effect
          </button>
        ) : null}
      </div>

      {editorOpen ? (
        <div className="condition-effect-editor stack">
          <div className="list-item__top">
            <h4 className="template-editor__title">
              {editingAugmentationId ? "Edit Effect" : "Add Effect"}
            </h4>
            <span className="muted">{conditionName}</span>
          </div>

          <div className="inline-group">
            <Field label="Name">
              <input
                value={values.name}
                aria-invalid={!values.name.trim()}
                onChange={(event) => onChange({ ...values, name: event.target.value })}
                placeholder="e.g. Poison penalty"
              />
            </Field>
            <Field label={values.effectType === "formula_modifier" ? "Sheet Value" : "Scope"}>
              <select
                value={targetIsKnown ? selectedTargetKey : ""}
                onChange={(event) => {
                  const target = targetOptions.find(
                    (option) => augmentationTargetOptionKey(option) === event.target.value
                  );
                  if (target) {
                    onChange(applyAugmentationTargetOption(values, target));
                  }
                }}
                disabled={targetOptions.length === 0}
              >
                <option value="">
                  {targetOptions.length === 0 ? "Targets unavailable" : "Select target"}
                </option>
                {!targetIsKnown && hasCurrentTargetPath ? (
                  <option value={selectedTargetKey} disabled>
                    Unavailable target ({selectedTargetKey})
                  </option>
                ) : null}
                {targetOptions.map((target) => (
                  <option
                    key={augmentationTargetOptionKey(target)}
                    value={augmentationTargetOptionKey(target)}
                  >
                    {formatAugmentationTargetOption(target)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Effect Type">
              <select
                value={values.effectType}
                onChange={(event) =>
                  onChange({
                    ...values,
                    effectType: event.target.value as AugmentationEditorValues["effectType"]
                  })
                }
              >
                {EFFECT_TYPES.map(([effectType, label]) => (
                  <option key={effectType} value={effectType}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            {values.effectType === "roll_mode_modifier" ? (
              <Field label="Roll Mode">
                <select
                  value={values.rollMode}
                  onChange={(event) =>
                    onChange({
                      ...values,
                      rollMode: event.target.value as AugmentationEditorValues["rollMode"]
                    })
                  }
                >
                  <option value="advantage">Advantage</option>
                  <option value="disadvantage">Disadvantage</option>
                </select>
              </Field>
            ) : (
              <Field label="Operation">
                <select
                  value={values.operation}
                  onChange={(event) =>
                    onChange({
                      ...values,
                      operation: event.target.value as AugmentationOperation
                    })
                  }
                >
                  {AUGMENTATION_OPERATIONS.map((operation) => (
                    <option key={operation} value={operation}>
                      {operation}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          <p className="muted">{describeAugmentationEffectType(values.effectType)}</p>

          <Field label="Description">
            <textarea
              rows={2}
              value={values.description}
              onChange={(event) => onChange({ ...values, description: event.target.value })}
              placeholder="Private effect notes"
            />
          </Field>

          {values.effectType !== "roll_mode_modifier" ? (
            <Field label="Formula">
              <textarea
                rows={2}
                value={values.formulaText}
                aria-invalid={!values.formulaText.trim()}
                onChange={(event) => onChange({ ...values, formulaText: event.target.value })}
                placeholder="@arcane - 2"
              />
            </Field>
          ) : null}

          {values.effectType !== "formula_modifier" ? (
            <FormulaModifierSelectorEditor
              idPrefix="condition-effect-selector"
              values={values}
              options={selectorOptions}
              onChange={onChange}
            />
          ) : null}

          <details className="condition-effect-lifecycle">
            <summary>Lifecycle (GM-tracked)</summary>
            <div className="inline-group">
              <Field label="Lifecycle">
                <select
                  value={values.lifecycleMode}
                  onChange={(event) =>
                    onChange({
                      ...values,
                      lifecycleMode: event.target.value as LifecycleMode
                    })
                  }
                >
                  {LIFECYCLE_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Remaining">
                <input
                  type="number"
                  min={0}
                  value={values.lifecycleRemaining}
                  onChange={(event) =>
                    onChange({ ...values, lifecycleRemaining: event.target.value })
                  }
                  placeholder="e.g. 3"
                />
              </Field>
              <Field label="Expiration note">
                <input
                  value={values.expiresAt}
                  onChange={(event) => onChange({ ...values, expiresAt: event.target.value })}
                  placeholder="e.g. end of scene"
                />
              </Field>
              <Field label="Remove when source inactive">
                <input
                  type="checkbox"
                  checked={values.removeWhenSourceInactive}
                  onChange={(event) =>
                    onChange({
                      ...values,
                      removeWhenSourceInactive: event.target.checked
                    })
                  }
                />
              </Field>
              <Field label="Notes">
                <input
                  value={values.lifecycleNotes}
                  onChange={(event) =>
                    onChange({ ...values, lifecycleNotes: event.target.value })
                  }
                  placeholder="e.g. cured"
                />
              </Field>
            </div>
          </details>

          <label className="augmentation-template-panel__active">
            <input
              type="checkbox"
              checked={values.active}
              onChange={(event) => onChange({ ...values, active: event.target.checked })}
            />
            <span>Enabled</span>
          </label>

          {validationError ? (
            <p className="error-text" role="alert">
              {validationError}
            </p>
          ) : null}
          <div className="template-editor__actions">
            <button
              className="button"
              type="button"
              onClick={onSubmit}
              disabled={Boolean(validationError)}
            >
              {editingAugmentationId ? "Save Effect" : "Add Effect"}
            </button>
            <button className="button button--secondary" type="button" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="list condition-effect-list">
        {templates.length === 0 ? <p className="muted">No effects configured.</p> : null}
        {templates.map((augmentation) => (
          <article
            className="list-item list-item--block augmentation-template-card"
            key={augmentation.id}
          >
            <div className="list-item__top">
              <strong>{augmentation.name}</strong>
              <span className="muted">
                {(augmentation.active ?? true) ? "enabled" : "disabled"}
              </span>
            </div>
            {augmentationEffectUsesTarget(augmentation) ? (
              <div className="muted">Changes: {formatTarget(augmentation)}</div>
            ) : null}
            <div className="muted">Behavior: {formatAugmentationEffect(augmentation)}</div>
            {augmentation.effect.type !== "formula_modifier" ? (
              <div className="muted">Applies to: {formatFormulaModifierSelector(augmentation)}</div>
            ) : null}
            {augmentation.description ? (
              <div className="muted">{augmentation.description}</div>
            ) : null}
            <div className="inline-actions">
              <button
                className="button button--secondary"
                type="button"
                onClick={() => onEdit(augmentation)}
              >
                Edit
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => onRemove(augmentation.id)}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
