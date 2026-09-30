import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type {
  AugmentationEffectType,
  AugmentationOperation,
  FormulaDefinition,
  LifecycleMode,
  StackingMode
} from "@/domain/models";
import {
  applyAugmentationTargetOption,
  augmentationEditorTargetKey,
  augmentationTargetOptionKey,
  formatAugmentationTargetOption,
  isKnownAugmentationEditorTarget,
  LIFECYCLE_MODE_OPTIONS,
  STACKING_MODE_OPTIONS,
  type AugmentationEditorValues,
  type AugmentationTargetOption
} from "@/features/augmentations/augmentationEditorValues";
import type { AugmentationSelectorOptions } from "@/features/augmentations/augmentationSelectorOptions";
import { FormulaModifierSelectorEditor } from "@/features/augmentations/components/FormulaModifierSelectorEditor";
import { EffectFormulaEditor } from "@/features/effects/components/EffectFormulaEditor";
import { hasValidStandaloneEffectValues } from "@/features/effects/standaloneEffectEditorValues";
import { Field } from "@/shared/ui/Field";
import { FormValidationSummary } from "@/shared/ui/FormValidationSummary";

const EFFECT_TYPES: Array<{
  type: AugmentationEffectType;
  title: string;
  description: string;
}> = [
  {
    type: "formula_modifier",
    title: "Change a character value",
    description: "Health, mana, a stat, resistance, or another stored value."
  },
  {
    type: "evaluation_formula_modifier",
    title: "Modify rolls or calculations",
    description: "Adjust matching results without changing the underlying character value."
  },
  {
    type: "proficiency_growth_modifier",
    title: "Modify proficiency growth",
    description: "Change points earned by proficiencies with matching tags."
  },
  {
    type: "roll_mode_modifier",
    title: "Grant advantage or disadvantage",
    description: "Change the roll mode for matching checks."
  }
];

const OPERATIONS: Array<{ value: AugmentationOperation; label: string }> = [
  { value: "add", label: "Add" },
  { value: "subtract", label: "Subtract" },
  { value: "multiply", label: "Multiply by" },
  { value: "divide", label: "Divide by" },
  { value: "set", label: "Replace with" }
];

export function StandaloneEffectEditorForm({
  editingEffectId,
  values,
  targetOptions,
  selectorOptions,
  formulas,
  formulaMetadata,
  validationAttempted = false,
  onChange,
  onSubmit,
  onCancel
}: {
  editingEffectId: string | null;
  values: AugmentationEditorValues;
  targetOptions: AugmentationTargetOption[];
  selectorOptions: AugmentationSelectorOptions;
  formulas: FormulaDefinition[];
  formulaMetadata: ActionFormulaAuthoringMetadata | null;
  validationAttempted?: boolean;
  onChange: (values: AugmentationEditorValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}): JSX.Element {
  const targetKey = augmentationEditorTargetKey(values);
  const targetIsKnown = isKnownAugmentationEditorTarget(values, targetOptions);
  const targetPathExists = values.targetPath.length > 0;
  const numericEffect = values.effectType !== "roll_mode_modifier";
  const directEffect = values.effectType === "formula_modifier";
  const formulaMissing = numericEffect && !values.formulaId.trim() && !values.formulaText.trim();
  const valid = hasValidStandaloneEffectValues(values) && targetIsKnown;

  return (
    <div className="effect-editor stack">
      <header className="effect-editor__header">
        <span>
          <h3>{editingEffectId ? "Edit Effect" : "Create Effect"}</h3>
          <small className="muted">
            Effects are reusable by actions, equipment, and conditions.
          </small>
        </span>
      </header>

      <Field label="Name" required invalid={validationAttempted && !values.name.trim()}>
        <input
          value={values.name}
          required
          aria-invalid={validationAttempted && !values.name.trim()}
          onChange={(event) => onChange({ ...values, name: event.target.value })}
          placeholder="e.g. Battle focus"
        />
      </Field>

      <section className="effect-editor__type-section stack" aria-labelledby="effect-kind-heading">
        <span>
          <strong id="effect-kind-heading">What does this effect do?</strong>
          <small className="muted">Choose one behavior. The editor below adapts to it.</small>
        </span>
        <div className="effect-type-grid" role="radiogroup" aria-label="Effect behavior">
          {EFFECT_TYPES.map((option) => (
            <button
              key={option.type}
              className={`effect-type-card${values.effectType === option.type ? " effect-type-card--selected" : ""}`}
              type="button"
              role="radio"
              aria-checked={values.effectType === option.type}
              onClick={() =>
                onChange({
                  ...values,
                  effectType: option.type,
                  targetRoot: "instance"
                })
              }
            >
              <strong>{option.title}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="effect-editor__configuration stack" aria-label="Effect configuration">
        <div className="effect-editor__section-heading">
          <strong>Configure the effect</strong>
          <span className="muted">
            {directEffect
              ? "Choose the character value, operation, and amount."
              : values.effectType === "proficiency_growth_modifier"
                ? "Choose the operation, amount, and matching proficiency tags."
                : values.effectType === "roll_mode_modifier"
                  ? "Choose the roll mode and which rolls receive it."
                  : "Choose the operation, amount, and which calculations receive it."}
          </span>
        </div>

        {directEffect ? (
          <Field
            label="Character value"
            required
            invalid={validationAttempted && !targetIsKnown && targetOptions.length > 0}
          >
            <select
              value={targetIsKnown ? targetKey : ""}
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
              aria-invalid={validationAttempted && !targetIsKnown && targetOptions.length > 0}
            >
              <option value="">
                {targetOptions.length === 0 ? "Character values unavailable" : "Select value"}
              </option>
              {!targetIsKnown && targetPathExists ? (
                <option value={targetKey} disabled>
                  Unavailable value ({targetKey})
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
        ) : null}

        {values.effectType === "roll_mode_modifier" ? (
          <Field label="Roll mode">
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
          <>
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
                {OPERATIONS.map((operation) => (
                  <option key={operation.value} value={operation.value}>
                    {operation.label}
                  </option>
                ))}
              </select>
            </Field>
            <EffectFormulaEditor
              values={values}
              formulas={formulas}
              metadata={formulaMetadata}
              validationAttempted={validationAttempted}
              onChange={onChange}
            />
          </>
        )}

        {!directEffect ? (
          <FormulaModifierSelectorEditor
            idPrefix="standalone-effect-selector"
            values={values}
            options={selectorOptions}
            showValidationError={validationAttempted}
            onChange={onChange}
          />
        ) : null}
      </section>

      <details className="authoring-disclosure">
        <summary>
          <span>
            <strong>Notes and availability</strong>
            <small>Add GM notes or temporarily disable this definition.</small>
          </span>
        </summary>
        <div className="authoring-disclosure__body stack">
          <Field label="Description">
            <textarea
              rows={2}
              value={values.description}
              onChange={(event) => onChange({ ...values, description: event.target.value })}
              placeholder="Optional GM-facing notes"
            />
          </Field>
          <label className="augmentation-template-panel__active">
            <input
              type="checkbox"
              checked={values.active}
              onChange={(event) => onChange({ ...values, active: event.target.checked })}
            />
            <span>Effect enabled</span>
          </label>
        </div>
      </details>

      <details className="authoring-disclosure">
        <summary>
          <span>
            <strong>Lifecycle</strong>
            <small>Optional GM-tracked duration and removal notes.</small>
          </span>
        </summary>
        <div className="authoring-disclosure__body inline-group">
          <Field label="Duration">
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
              onChange={(event) => onChange({ ...values, lifecycleRemaining: event.target.value })}
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
          <Field label="Removal notes">
            <input
              value={values.lifecycleNotes}
              onChange={(event) => onChange({ ...values, lifecycleNotes: event.target.value })}
              placeholder="e.g. removed by a cure"
            />
          </Field>
          <label className="augmentation-template-panel__active">
            <input
              type="checkbox"
              checked={values.removeWhenSourceInactive}
              onChange={(event) =>
                onChange({ ...values, removeWhenSourceInactive: event.target.checked })
              }
            />
            Remove when its source becomes inactive
          </label>
        </div>
      </details>

      <details className="authoring-disclosure">
        <summary>
          <span>
            <strong>Stacking</strong>
            <small>Choose whether repeated applications accumulate.</small>
          </span>
        </summary>
        <div className="authoring-disclosure__body inline-group">
          <Field label="Repeated applications">
            <select
              value={values.stackingMode}
              onChange={(event) =>
                onChange({
                  ...values,
                  stackingMode: event.target.value as StackingMode
                })
              }
            >
              {STACKING_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          {values.stackingMode === "stack" ? (
            <Field label="Maximum stacks">
              <input
                type="number"
                min={1}
                value={values.stackingMaxStacks}
                onChange={(event) => onChange({ ...values, stackingMaxStacks: event.target.value })}
                placeholder="Blank means unlimited"
              />
            </Field>
          ) : null}
        </div>
      </details>

      <FormValidationSummary
        visible={validationAttempted && !valid}
        message={
          !values.name.trim() ||
          (directEffect && !targetIsKnown && targetOptions.length > 0) ||
          formulaMissing
            ? "Complete the highlighted effect fields."
            : "Required and excluded tags cannot overlap."
        }
      />

      <footer className="effect-editor__footer">
        <button
          className="button"
          type="button"
          onClick={onSubmit}
          disabled={directEffect && targetOptions.length === 0}
        >
          {editingEffectId ? "Save Effect" : "Create Effect"}
        </button>
        {editingEffectId ? (
          <button className="button button--secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </footer>
    </div>
  );
}
