import type { AugmentationEditorValues } from "@/features/augmentations/augmentationEditorValues";
import type { AugmentationSelectorOptions } from "@/features/augmentations/augmentationSelectorOptions";
import { FormulaTagEditor } from "@/features/formulas/components/FormulaTagEditor";
import { normalizeFormulaTags } from "@/features/formulas/formulaTags";
import { Field } from "@/shared/ui/Field";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";

export function FormulaModifierSelectorEditor({
  idPrefix,
  values,
  options,
  showValidationError = true,
  onChange
}: {
  idPrefix: string;
  values: AugmentationEditorValues;
  options: AugmentationSelectorOptions;
  showValidationError?: boolean;
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
          Narrow the modifier down to specific tags, actions, formulas, or steps. Leave a field on
          &ldquo;Any&rdquo; to match everything. Every filled-in constraint must match for the
          modifier to apply.
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

      {showValidationError && overlap.length > 0 ? (
        <p className="error-text" role="alert">
          Tags cannot be both required and excluded: {overlap.join(", ")}.
        </p>
      ) : null}

      <div className="inline-group">
        <CatalogEntityPicker
          catalog="actions"
          label="Limit to Action"
          placeholder="Any action or search catalog"
          selectedId={values.selectorActionId}
          options={[
            { id: "", label: "Any action", value: "" },
            ...options.actions.map((option) => ({
              id: option.id,
              label: option.label,
              value: option.id
            }))
          ]}
          onSelect={(selectorActionId) => onChange({ ...values, selectorActionId })}
        />
        <CatalogEntityPicker
          catalog="formulas"
          label="Limit to Formula"
          placeholder="Any formula or search catalog"
          selectedId={values.selectorFormulaId}
          options={[
            { id: "", label: "Any formula", value: "" },
            ...options.formulas.map((option) => ({
              id: option.id,
              label: option.label,
              value: option.id
            }))
          ]}
          onSelect={(selectorFormulaId) => onChange({ ...values, selectorFormulaId })}
        />
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
