import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { Augmentation } from "@/domain/models";
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
  type AugmentationEditorValues,
  type AugmentationTargetOption
} from "@/features/augmentations/augmentationEditorValues";
import type { AugmentationSelectorOptions } from "@/features/augmentations/augmentationSelectorOptions";
import { FormulaModifierSelectorEditor } from "@/features/augmentations/components/FormulaModifierSelectorEditor";
import { FormulaVariableInput } from "@/features/variables/components/FormulaVariableInput";
import {
  formulaVariableSearchOptions,
  upsertFormulaAlias
} from "@/features/variables/variablePicker";
import { FormValidationSummary } from "@/shared/ui/FormValidationSummary";
import { useFormValidationAttempt } from "@/shared/ui/useFormValidationAttempt";

const AUGMENTATION_OPERATIONS = ["add", "subtract", "multiply", "divide", "set"] as const;
const AUGMENTATION_EFFECT_TYPES = [
  ["formula_modifier", "Direct wearer value"],
  ["evaluation_formula_modifier", "Matching formula value"],
  ["roll_mode_modifier", "Matching roll mode"]
] as const;

function formatTarget(augmentation: Augmentation): string {
  const path = augmentation.target.path.length > 0 ? augmentation.target.path.join(".") : "(none)";
  return `${augmentation.target.root}.${path}`;
}

function EffectTemplateGrid({
  templates,
  onEdit,
  onRemove
}: {
  templates: Augmentation[];
  onEdit: (augmentation: Augmentation) => void;
  onRemove: (augmentationId: string) => void;
}): JSX.Element {
  return (
    <div className="item-effect-grid" aria-label="Attached equipment effects">
      {templates.length === 0 ? (
        <p className="muted item-effect-grid__empty">No equipment effects attached yet.</p>
      ) : null}
      {templates.map((augmentation) => (
        <article className="item-effect-card" key={augmentation.id}>
          <button
            className="item-effect-card__edit"
            type="button"
            aria-label={`Edit ${augmentation.name} equipment effect`}
            onClick={() => onEdit(augmentation)}
          >
            <span className="item-effect-card__heading">
              <strong>{augmentation.name}</strong>
              <span className="badge">
                {augmentation.effect.type === "formula_modifier" ? "Wearer" : "Roll / formula"}
              </span>
            </span>
            <span className="muted item-effect-card__summary">
              {formatAugmentationEffect(augmentation)}
            </span>
            {augmentationEffectUsesTarget(augmentation) ? (
              <span className="muted item-effect-card__target">{formatTarget(augmentation)}</span>
            ) : (
              <span className="muted item-effect-card__target">
                {formatFormulaModifierSelector(augmentation)}
              </span>
            )}
          </button>
          <button
            className="button button--secondary item-effect-card__remove"
            type="button"
            aria-label={`Remove ${augmentation.name} equipment effect`}
            onClick={() => onRemove(augmentation.id)}
          >
            Remove
          </button>
        </article>
      ))}
    </div>
  );
}

export function ItemAugmentationTemplatePanel({
  itemName,
  editingAugmentationId,
  templates,
  targetOptions,
  selectorOptions,
  formulaMetadata,
  values,
  focused,
  onChange,
  onFocusedChange,
  onSubmit,
  onCancel,
  onEdit,
  onRemove
}: {
  itemName: string;
  editingAugmentationId: string | null;
  templates: Augmentation[];
  targetOptions: AugmentationTargetOption[];
  selectorOptions: AugmentationSelectorOptions;
  formulaMetadata: ActionFormulaAuthoringMetadata | null;
  values: AugmentationEditorValues;
  focused: boolean;
  onChange: (values: AugmentationEditorValues) => void;
  onFocusedChange: (focused: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onEdit: (augmentation: Augmentation) => void;
  onRemove: (augmentationId: string) => void;
}): JSX.Element {
  const selectedTargetKey = augmentationEditorTargetKey(values);
  const hasCurrentTargetPath = values.targetPath.some((segment) => segment.trim().length > 0);
  const targetIsKnown = isKnownAugmentationEditorTarget(values, targetOptions);
  const canSubmit = hasValidAugmentationEditorValues(values) && targetIsKnown;
  const validation = useFormValidationAttempt();

  const closeEditor = (): void => {
    onFocusedChange(false);
    validation.reset();
    onCancel();
  };

  const startNewEffect = (): void => {
    onCancel();
    validation.reset();
    onFocusedChange(true);
  };

  const startEditingEffect = (augmentation: Augmentation): void => {
    onEdit(augmentation);
    validation.reset();
    onFocusedChange(true);
  };

  return (
    <section className={`item-effect-panel${focused ? " item-effect-panel--focused" : ""}`}>
      {!focused ? (
        <>
          <div className="item-effect-panel__toolbar">
            <span className="muted">{templates.length} attached</span>
            <button className="button" type="button" onClick={startNewEffect}>
              Add Effect
            </button>
          </div>

          <EffectTemplateGrid
            templates={templates}
            onEdit={startEditingEffect}
            onRemove={onRemove}
          />
        </>
      ) : (
        <>
          <div className="item-effect-focus__navigation">
            <button className="button button--secondary" type="button" onClick={closeEditor}>
              Back to Item
            </button>
            <span>
              <strong>
                {editingAugmentationId ? "Edit Equipment Effect" : "New Equipment Effect"}
              </strong>
              <small className="muted">
                Active while {itemName} is equipped. Changes remain in this Item draft.
              </small>
            </span>
          </div>
          <div className="template-editor augmentation-template-panel item-effect-editor stack">
            <div className="inline-group">
              <Field label="Name" required invalid={validation.attempted && !values.name.trim()}>
                <input
                  value={values.name}
                  required
                  aria-invalid={validation.attempted && !values.name.trim()}
                  onChange={(event) => onChange({ ...values, name: event.target.value })}
                  placeholder="e.g. Arcane guard"
                />
              </Field>
              <Field
                label={values.effectType === "formula_modifier" ? "Wearer Value" : "Effect Scope"}
                required
                invalid={validation.attempted && !targetIsKnown && targetOptions.length > 0}
              >
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
                  required
                  aria-invalid={validation.attempted && !targetIsKnown && targetOptions.length > 0}
                >
                  <option value="">
                    {targetOptions.length === 0 ? "Target metadata unavailable" : "Select target"}
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
                  {AUGMENTATION_EFFECT_TYPES.map(([effectType, label]) => (
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
                    <option value="advantage">advantage</option>
                    <option value="disadvantage">disadvantage</option>
                  </select>
                </Field>
              ) : (
                <Field label="Operation">
                  <select
                    value={values.operation}
                    onChange={(event) =>
                      onChange({
                        ...values,
                        operation: event.target.value as AugmentationEditorValues["operation"]
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
                placeholder="GM-facing augmentation notes"
              />
            </Field>

            {values.effectType !== "roll_mode_modifier" ? (
              <FormulaVariableInput
                label="Formula"
                rows={2}
                value={values.formulaText}
                options={formulaVariableSearchOptions(formulaMetadata)}
                loading={!formulaMetadata}
                required
                ariaInvalid={validation.attempted && !values.formulaText.trim()}
                onChange={(formulaText) => onChange({ ...values, formulaText })}
                onVariableSelect={(entry, formulaText) =>
                  onChange({
                    ...values,
                    formulaText,
                    formulaAliases: upsertFormulaAlias(values.formulaAliases, entry.alias)
                  })
                }
                placeholder="Type @ to insert a variable"
              />
            ) : null}

            {values.effectType !== "formula_modifier" ? (
              <FormulaModifierSelectorEditor
                idPrefix="item-augmentation-selector"
                values={values}
                options={selectorOptions}
                showValidationError={validation.attempted}
                onChange={onChange}
              />
            ) : null}

            <label className="augmentation-template-panel__active">
              <input
                type="checkbox"
                checked={values.active}
                onChange={(event) => onChange({ ...values, active: event.target.checked })}
              />
              <span>Active</span>
            </label>

            <FormValidationSummary
              visible={validation.attempted && !canSubmit}
              message={
                !values.name.trim() ||
                (!targetIsKnown && targetOptions.length > 0) ||
                (values.effectType !== "roll_mode_modifier" && !values.formulaText.trim())
                  ? "Complete all required fields."
                  : "Review the indicated fields."
              }
            />

            <div className="template-editor__actions item-effect-editor__actions">
              <button
                className="button"
                type="button"
                onClick={() => {
                  if (validation.validate(canSubmit)) {
                    onSubmit();
                    onFocusedChange(false);
                    validation.reset();
                  }
                }}
                disabled={targetOptions.length === 0}
              >
                {editingAugmentationId ? "Update Effect" : "Add Effect"}
              </button>
              <button className="button button--secondary" type="button" onClick={closeEditor}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
