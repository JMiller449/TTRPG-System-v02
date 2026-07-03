import type { AugmentationEditorValues } from "@/features/augmentations/augmentationEditorValues";
import type { AugmentationSelectorOptions } from "@/features/augmentations/augmentationSelectorOptions";
import { FormulaTagEditor } from "@/features/formulas/components/FormulaTagEditor";
import { normalizeFormulaTags } from "@/features/formulas/formulaTags";
import { Field } from "@/shared/ui/Field";

export function FormulaModifierSelectorEditor({
  idPrefix,
  values,
  options,
  onChange
}: {
  idPrefix: string;
  values: AugmentationEditorValues;
  options: AugmentationSelectorOptions;
  onChange: (values: AugmentationEditorValues) => void;
}): JSX.Element {
  const requiredTags = normalizeFormulaTags(values.selectorRequiredTags);
  const excludedTags = normalizeFormulaTags(values.selectorExcludedTags);
  const overlap = requiredTags.filter((tag) => excludedTags.includes(tag));
  const stepOptions = values.selectorActionId.trim()
    ? options.steps.filter((step) => step.actionId === values.selectorActionId.trim())
    : options.steps;

  return (
    <section className="formula-selector-editor stack" aria-label="Formula modifier selector">
      <div>
        <strong>Formula Match Selector</strong>
        <p className="muted formula-selector-editor__hint">
          All populated constraints must match. Evaluation-time effects apply while the
          concrete effect is active or the attached item is equipped; direct state modifiers
          ignore this selector.
        </p>
      </div>

      <div className="inline-group">
        <FormulaTagEditor
          label="Required Formula Tags"
          tags={requiredTags}
          suggestions={options.tags}
          onChange={(selectorRequiredTags) => onChange({ ...values, selectorRequiredTags })}
        />
        <FormulaTagEditor
          label="Excluded Formula Tags"
          tags={excludedTags}
          suggestions={options.tags}
          onChange={(selectorExcludedTags) => onChange({ ...values, selectorExcludedTags })}
        />
      </div>

      {overlap.length > 0 ? (
        <p className="error-text" role="alert">
          Tags cannot be both required and excluded: {overlap.join(", ")}.
        </p>
      ) : null}

      <div className="inline-group">
        <Field label="Exact Action ID">
          <input
            list={`${idPrefix}-action-options`}
            value={values.selectorActionId}
            onChange={(event) => onChange({ ...values, selectorActionId: event.target.value })}
            placeholder="Any action"
          />
          <datalist id={`${idPrefix}-action-options`}>
            {options.actions.map((option) => (
              <option key={option.id} value={option.id} label={option.label} />
            ))}
          </datalist>
        </Field>
        <Field label="Exact Formula ID">
          <input
            list={`${idPrefix}-formula-options`}
            value={values.selectorFormulaId}
            onChange={(event) => onChange({ ...values, selectorFormulaId: event.target.value })}
            placeholder="Any formula"
          />
          <datalist id={`${idPrefix}-formula-options`}>
            {options.formulas.map((option) => (
              <option key={option.id} value={option.id} label={option.label} />
            ))}
          </datalist>
        </Field>
        <Field label="Exact Step ID">
          <input
            list={`${idPrefix}-step-options`}
            value={values.selectorStepId}
            onChange={(event) => onChange({ ...values, selectorStepId: event.target.value })}
            placeholder="Any step"
          />
          <datalist id={`${idPrefix}-step-options`}>
            {stepOptions.map((option) => (
              <option
                key={`${option.actionId}:${option.id}`}
                value={option.id}
                label={option.label}
              />
            ))}
          </datalist>
        </Field>
      </div>

      <label className="augmentation-template-panel__active">
        <input
          checked={values.selectorSameSourceItem}
          type="checkbox"
          onChange={(event) =>
            onChange({ ...values, selectorSameSourceItem: event.target.checked })
          }
        />
        Same source item only
      </label>
    </section>
  );
}
