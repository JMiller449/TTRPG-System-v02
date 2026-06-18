import { Field } from "@/shared/ui/Field";
import type { FormulaEditorValues } from "@/features/formulas/formulaEditorValues";

export function FormulaEditorForm({
  editingFormulaId,
  values,
  onChange,
  onSubmit,
  onCancel
}: {
  editingFormulaId: string | null;
  values: FormulaEditorValues;
  onChange: (values: FormulaEditorValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <div className="template-editor formula-editor">
      <p className="template-editor__title">{editingFormulaId ? "Edit Formula" : "Create Formula"}</p>
      <div className="stack">
        <Field label="Formula">
          <textarea
            rows={4}
            value={values.formulaText}
            onChange={(event) => onChange({ ...values, formulaText: event.target.value })}
            placeholder="@arcane * 8"
          />
        </Field>

        {values.aliases && values.aliases.length > 0 ? (
          <div className="list">
            {values.aliases.map((alias) => (
              <div className="muted" key={`${alias.name}:${alias.path.join(".")}`}>
                {alias.name}: {alias.path.join(".")}
              </div>
            ))}
          </div>
        ) : null}

        <div className="template-editor__actions">
          <button className="button" onClick={onSubmit}>
            {editingFormulaId ? "Save Formula" : "Create Formula"}
          </button>
          {editingFormulaId ? (
            <button className="button button--secondary" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
