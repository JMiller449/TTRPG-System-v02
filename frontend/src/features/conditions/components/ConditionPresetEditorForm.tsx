import type { ReactNode } from "react";
import { Field } from "@/shared/ui/Field";
import {
  hasValidConditionPresetValues,
  type ConditionPresetEditorValues
} from "@/features/conditions/conditionEditorValues";
import { FormValidationSummary } from "@/shared/ui/FormValidationSummary";

export function ConditionPresetEditorForm({
  editingConditionId,
  values,
  onChange,
  onSubmit,
  onCancel,
  validationAttempted = false,
  hasOpenEffectEditor,
  effectEditor
}: {
  editingConditionId: string | null;
  values: ConditionPresetEditorValues;
  onChange: (values: ConditionPresetEditorValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  validationAttempted?: boolean;
  hasOpenEffectEditor: boolean;
  effectEditor: ReactNode;
}): JSX.Element {
  const nameIsValid = hasValidConditionPresetValues(values);
  const validationError = !nameIsValid
    ? "Name is required."
    : hasOpenEffectEditor
      ? "Save or cancel the open effect before saving the condition."
      : null;

  return (
    <div className="template-editor condition-editor stack">
      <h3 className="template-editor__title">
        {editingConditionId ? "Edit Condition" : "Create Condition"}
      </h3>
      <div className="stack">
        <div className="inline-group">
          <Field label="Name" required invalid={validationAttempted && !nameIsValid}>
            <input
              value={values.name}
              required
              aria-invalid={validationAttempted && !nameIsValid}
              onChange={(event) => onChange({ ...values, name: event.target.value })}
              placeholder="e.g. Poisoned"
            />
          </Field>
          <Field label="Visibility">
            <select
              value={values.visibility}
              onChange={(event) =>
                onChange({
                  ...values,
                  visibility: event.target.value === "gm_only" ? "gm_only" : "public"
                })
              }
            >
              <option value="public">Public</option>
              <option value="gm_only">GM Only</option>
            </select>
          </Field>
        </div>

        <Field label="Description">
          <textarea
            rows={3}
            value={values.description}
            onChange={(event) => onChange({ ...values, description: event.target.value })}
            placeholder="Condition text, table notes, or status reminder"
          />
        </Field>

        {effectEditor}

        <FormValidationSummary
          visible={validationAttempted && Boolean(validationError)}
          message={
            !nameIsValid
              ? "Complete all required fields."
              : (validationError ?? "Review the indicated fields.")
          }
        />
        <div className="template-editor__actions">
          <button className="button" onClick={onSubmit}>
            {editingConditionId ? "Save Condition" : "Create Condition"}
          </button>
          {editingConditionId ? (
            <button className="button button--secondary" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
