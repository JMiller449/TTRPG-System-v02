import { Field } from "@/shared/ui/Field";
import type { ConditionPresetEditorValues } from "@/features/conditions/conditionEditorValues";

export function ConditionPresetEditorForm({
  editingConditionId,
  values,
  onChange,
  onSubmit,
  onCancel
}: {
  editingConditionId: string | null;
  values: ConditionPresetEditorValues;
  onChange: (values: ConditionPresetEditorValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <div className="template-editor condition-editor">
      <p className="template-editor__title">
        {editingConditionId ? "Edit Condition" : "Create Condition"}
      </p>
      <div className="stack">
        <div className="inline-group">
          <Field label="Name">
            <input
              value={values.name}
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
