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
        <strong>Which Rolls Does This Affect?</strong>
        <p className="muted formula-selector-editor__hint">
          Narrow the modifier down to specific tags, actions, formulas, or steps. Leave a
          field on &ldquo;Any&rdquo; to match everything. Every filled-in constraint must
          match for the modifier to apply.
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
        <Field label="Limit to Action">
          <select
            id={`${idPrefix}-action-options`}
            value={values.selectorActionId}
            onChange={(event) => onChange({ ...values, selectorActionId: event.target.value })}
          >
            <option value="">Any action</option>
            {options.actions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Limit to Formula">
          <select
            id={`${idPrefix}-formula-options`}
            value={values.selectorFormulaId}
            onChange={(event) => onChange({ ...values, selectorFormulaId: event.target.value })}
          >
            <option value="">Any formula</option>
            {options.formulas.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Limit to Step">
          <select
            id={`${idPrefix}-step-options`}
            value={values.selectorStepId}
            onChange={(event) => onChange({ ...values, selectorStepId: event.target.value })}
          >
            <option value="">Any step</option>
            {stepOptions.map((option) => (
              <option key={`${option.actionId}:${option.id}`} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
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
