import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type { AugmentationOperation } from "@/domain/models";
import {
  applyAugmentationTargetOption,
  augmentationEditorTargetKey,
  augmentationTargetOptionKey,
  formatAugmentationTargetOption,
  isKnownAugmentationEditorTarget,
  type AugmentationEditorValues,
  type AugmentationTargetOption
} from "@/features/augmentations/augmentationEditorValues";
import type { AugmentationSelectorOptions } from "@/features/augmentations/augmentationSelectorOptions";
import { FormulaModifierSelectorEditor } from "@/features/augmentations/components/FormulaModifierSelectorEditor";
import { hasValidStandaloneEffectValues } from "@/features/effects/standaloneEffectEditorValues";
import { VariableSearchPicker } from "@/features/variables/components/VariableSearchPicker";
import {
  appendFormulaToken,
  upsertFormulaAlias,
  type VariablePickerEntry
} from "@/features/variables/variablePicker";
import { Field } from "@/shared/ui/Field";

const EFFECT_TYPES = [
  ["formula_modifier", "Direct instance value"],
  ["evaluation_formula_modifier", "Matching formula value"],
  ["roll_mode_modifier", "Matching roll mode"]
] as const;
const OPERATIONS: readonly AugmentationOperation[] = [
  "add",
  "subtract",
  "multiply",
  "divide",
  "set"
];

export function StandaloneEffectEditorForm({
  editingEffectId,
  values,
  targetOptions,
  selectorOptions,
  formulaMetadata,
  onChange,
  onSubmit,
  onCancel
}: {
  editingEffectId: string | null;
  values: AugmentationEditorValues;
  targetOptions: AugmentationTargetOption[];
  selectorOptions: AugmentationSelectorOptions;
  formulaMetadata: ActionFormulaAuthoringMetadata | null;
  onChange: (values: AugmentationEditorValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}): JSX.Element {
  const targetKey = augmentationEditorTargetKey(values);
  const targetIsKnown = isKnownAugmentationEditorTarget(values, targetOptions);
  const targetPathExists = values.targetPath.length > 0;
  const valid = hasValidStandaloneEffectValues(values) && targetIsKnown;
  const insertVariable = (entry: VariablePickerEntry): void => {
    onChange({
      ...values,
      formulaText: appendFormulaToken(values.formulaText, entry.token),
      formulaAliases: upsertFormulaAlias(values.formulaAliases, entry.alias)
    });
  };

  return (
    <div className="template-editor condition-editor stack">
      <h3 className="template-editor__title">
        {editingEffectId ? "Edit Action-Controlled Effect" : "Create Action-Controlled Effect"}
      </h3>

      <div className="inline-group">
        <Field label="Name">
          <input
            value={values.name}
            aria-invalid={!values.name.trim()}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
            placeholder="e.g. Burning weapon"
          />
        </Field>
        <Field
          label={values.effectType === "formula_modifier" ? "Instance Value" : "Context Value"}
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
          >
            <option value="">
              {targetOptions.length === 0 ? "Targets unavailable" : "Select target"}
            </option>
            {!targetIsKnown && targetPathExists ? (
              <option value={targetKey} disabled>
                Unavailable target ({targetKey})
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
            {EFFECT_TYPES.map(([type, label]) => (
              <option key={type} value={type}>
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
                onChange({ ...values, operation: event.target.value as AugmentationOperation })
              }
            >
              {OPERATIONS.map((operation) => (
                <option key={operation} value={operation}>
                  {operation}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <Field label="Description">
        <textarea
          rows={2}
          value={values.description}
          onChange={(event) => onChange({ ...values, description: event.target.value })}
          placeholder="GM-facing effect notes"
        />
      </Field>

      {values.effectType !== "roll_mode_modifier" ? (
        <div className="stack">
          <Field label="Formula">
            <textarea
              rows={2}
              value={values.formulaText}
              aria-invalid={!values.formulaText.trim()}
              onChange={(event) => onChange({ ...values, formulaText: event.target.value })}
              placeholder="2 or @arcane * 0.1"
            />
          </Field>
          <VariableSearchPicker
            metadata={formulaMetadata}
            mode="formula"
            label="Insert Formula Variable"
            onPick={insertVariable}
          />
        </div>
      ) : null}

      {values.effectType !== "formula_modifier" ? (
        <FormulaModifierSelectorEditor
          idPrefix="standalone-effect-selector"
          values={values}
          options={selectorOptions}
          onChange={onChange}
        />
      ) : null}

      <details className="condition-effect-lifecycle">
        <summary>Manual lifecycle notes</summary>
        <div className="inline-group">
          <Field label="Duration note">
            <input
              value={values.duration}
              onChange={(event) => onChange({ ...values, duration: event.target.value })}
              placeholder="e.g. encounter"
            />
          </Field>
          <Field label="Expiration note">
            <input
              value={values.expiresAt}
              onChange={(event) => onChange({ ...values, expiresAt: event.target.value })}
              placeholder="e.g. end of scene"
            />
          </Field>
          <Field label="Removal note">
            <input
              value={values.removalCondition}
              onChange={(event) => onChange({ ...values, removalCondition: event.target.value })}
              placeholder="e.g. action removes effect"
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
        <span>Available to actions</span>
      </label>

      {!values.name.trim() ? <p className="error-text">Name is required.</p> : null}
      {!targetIsKnown ? <p className="error-text">Select an instance target.</p> : null}
      {values.effectType !== "roll_mode_modifier" && !values.formulaText.trim() ? (
        <p className="error-text">Formula is required.</p>
      ) : null}
      <div className="template-editor__actions">
        <button className="button" type="button" onClick={onSubmit} disabled={!valid}>
          {editingEffectId ? "Save Effect" : "Create Effect"}
        </button>
        {editingEffectId ? (
          <button className="button button--secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
