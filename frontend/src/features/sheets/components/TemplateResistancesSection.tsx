import {
  RESISTANCE_FIELDS,
  type ResistanceKey
} from "@/features/sheets/sheetDefinitionEditing";
import type { TemplateEditorValues } from "@/features/sheets/templateEditorTypes";
import { Field } from "@/shared/ui/Field";

export function TemplateResistancesSection({
  values,
  onChange
}: {
  values: TemplateEditorValues;
  onChange: (next: TemplateEditorValues) => void;
}): JSX.Element {
  const updateResistance = (key: ResistanceKey, value: string): void => {
    onChange({ ...values, resistances: { ...values.resistances, [key]: value } });
  };
  return (
    <section
      className="template-builder__section stack"
      aria-labelledby="template-resistances-title"
    >
      <div>
        <h3 id="template-resistances-title">Resistances</h3>
        <p className="muted">Percent values from 0 to 100. The backend applies final caps.</p>
      </div>
      <div className="template-builder__resistance-grid">
        {RESISTANCE_FIELDS.map(([key, label]) => (
          <Field key={key} label={`${label} (%)`}>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={values.resistances[key]}
              onChange={(event) => updateResistance(key, event.target.value)}
            />
          </Field>
        ))}
      </div>
    </section>
  );
}
