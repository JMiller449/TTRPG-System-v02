import { useState } from "react";
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
  const [showAll, setShowAll] = useState(false);
  const updateResistance = (key: ResistanceKey, value: string): void => {
    onChange({ ...values, resistances: { ...values.resistances, [key]: value } });
  };
  const visibleFields = RESISTANCE_FIELDS.filter(
    ([key], index) => showAll || index < 3 || Number(values.resistances[key]) !== 0
  );
  const hiddenCount = RESISTANCE_FIELDS.length - visibleFields.length;
  return (
    <section
      className="template-builder__section stack"
      aria-labelledby="template-resistances-title"
    >
      <div>
        <h3 id="template-resistances-title">Resistances</h3>
        <p className="muted">
          Optional percentage reductions. Leave these at zero for a normal template; final damage
          remains calculated by the backend.
        </p>
      </div>
      <div className="template-builder__resistance-grid">
        {visibleFields.map(([key, label]) => (
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
      <button
        type="button"
        className="button button--secondary template-builder__show-more"
        onClick={() => setShowAll((current) => !current)}
      >
        {showAll ? "Show common resistances only" : `Show all resistances (${hiddenCount} more)`}
      </button>
    </section>
  );
}
