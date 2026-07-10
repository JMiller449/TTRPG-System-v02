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
import { VariableSearchPicker } from "@/features/variables/components/VariableSearchPicker";
import {
  appendFormulaToken,
  upsertFormulaAlias,
  type VariablePickerEntry
} from "@/features/variables/variablePicker";

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

function EffectTemplateList({
  title,
  templates,
  onEdit,
  onRemove
}: {
  title: string;
  templates: Augmentation[];
  onEdit: (augmentation: Augmentation) => void;
  onRemove: (augmentationId: string) => void;
}): JSX.Element {
  return (
    <section className="item-effect-list stack">
      <h4>{title}</h4>
      {templates.length === 0 ? <p className="muted">None.</p> : null}
      {templates.map((augmentation) => (
        <article
          className="list-item list-item--block augmentation-template-card"
          key={augmentation.id}
        >
          <div className="list-item__top">
            <strong>{augmentation.name}</strong>
            <span className="muted">{(augmentation.active ?? true) ? "active" : "inactive"}</span>
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
    </section>
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
  onChange,
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
  onChange: (values: AugmentationEditorValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onEdit: (augmentation: Augmentation) => void;
  onRemove: (augmentationId: string) => void;
}): JSX.Element {
  const selectedTargetKey = augmentationEditorTargetKey(values);
  const hasCurrentTargetPath = values.targetPath.some((segment) => segment.trim().length > 0);
  const targetIsKnown = isKnownAugmentationEditorTarget(values, targetOptions);
  const canSubmit = hasValidAugmentationEditorValues(values) && targetIsKnown;
  const wearerEffects = templates.filter(
    (augmentation) => augmentation.effect.type === "formula_modifier"
  );
  const rollAndFormulaEffects = templates.filter(
    (augmentation) => augmentation.effect.type !== "formula_modifier"
  );
  const insertVariable = (entry: VariablePickerEntry): void => {
    onChange({
      ...values,
      formulaText: appendFormulaToken(values.formulaText, entry.token),
      formulaAliases: upsertFormulaAlias(values.formulaAliases, entry.alias)
    });
  };

  return (
    <section className="template-editor augmentation-template-panel">
      <div className="list-item__top">
        <p className="template-editor__title">Equipment Effects</p>
        <span className="muted">{itemName}</span>
      </div>

      <div className="stack">
        <div className="inline-group">
          <Field label="Name">
            <input
              value={values.name}
              onChange={(event) => onChange({ ...values, name: event.target.value })}
              placeholder="e.g. Arcane guard"
            />
          </Field>
          <Field label={values.effectType === "formula_modifier" ? "Wearer Value" : "Effect Scope"}>
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
          <div className="stack">
            <Field label="Formula">
              <textarea
                rows={2}
                value={values.formulaText}
                onChange={(event) => onChange({ ...values, formulaText: event.target.value })}
                placeholder="@arcane + 2"
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
            idPrefix="item-augmentation-selector"
            values={values}
            options={selectorOptions}
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

        <div className="template-editor__actions">
          <button className="button" onClick={onSubmit} disabled={!canSubmit}>
            {editingAugmentationId ? "Update Effect" : "Add Effect"}
          </button>
          {editingAugmentationId ? (
            <button className="button button--secondary" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>

        <div className="item-effect-lists">
          <EffectTemplateList
            title="Wearer Effects"
            templates={wearerEffects}
            onEdit={onEdit}
            onRemove={onRemove}
          />
          <EffectTemplateList
            title="Roll / Formula Effects"
            templates={rollAndFormulaEffects}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        </div>
      </div>
    </section>
  );
}
