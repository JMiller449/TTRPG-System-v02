import { Field } from "@/shared/ui/Field";
import type { ProficiencyEditorValues } from "@/features/proficiencies/proficiencyEditorValues";

export function ProficiencyEditorForm({
  editingProficiencyId,
  values,
  pending = false,
  validationError,
  onChange,
  onSubmit,
  onCancel
}: {
  editingProficiencyId: string | null;
  values: ProficiencyEditorValues;
  pending?: boolean;
  validationError?: string | null;
  onChange: (values: ProficiencyEditorValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <div className="template-editor proficiency-editor">
      <p className="template-editor__title">
        {editingProficiencyId ? "Edit Proficiency" : "Create Proficiency"}
      </p>
      <div className="stack">
        <div className="inline-group">
          <Field label="Name">
            <input
              value={values.name}
              onChange={(event) => onChange({ ...values, name: event.target.value })}
              placeholder="e.g. Longsword"
            />
          </Field>
          <Field label="Category">
            <select
              value={values.category}
              onChange={(event) =>
                onChange({
                  ...values,
                  category: event.target.value as ProficiencyEditorValues["category"]
                })
              }
            >
              <option value="custom">Custom</option>
              <option value="weapon_family">Weapon Family</option>
            </select>
          </Field>
          <Field label="Default Growth Rate">
            <input
              type="number"
              min="0"
              step="0.001"
              value={values.defaultGrowthRate}
              onChange={(event) =>
                onChange({ ...values, defaultGrowthRate: event.target.value })
              }
              placeholder="0.01"
            />
          </Field>
        </div>

        <p className="muted">
          Used when an action first adds this proficiency to a character. Enter a fraction;
          0.01 means 1% per qualifying use.
        </p>

        <Field label="Description">
          <textarea
            rows={3}
            value={values.description}
            onChange={(event) => onChange({ ...values, description: event.target.value })}
            placeholder="Training, skill, weapon, or spell notes"
          />
        </Field>

        {validationError ? (
          <p className="error-text" role="alert">
            {validationError}
          </p>
        ) : null}
        <div className="template-editor__actions">
          <button
            className="button"
            onClick={onSubmit}
            disabled={pending || Boolean(validationError)}
          >
            {pending
              ? "Creating…"
              : editingProficiencyId
                ? "Save Proficiency"
                : "Create Proficiency"}
          </button>
          {editingProficiencyId ? (
            <button className="button button--secondary" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
