import { useEffect, useState } from "react";
import type { Resistances } from "@/domain/models";
import {
  parseResistancePercentDraft,
  RESISTANCE_FIELDS,
  toResistancePercentDraft,
  type ResistancePercentDraft
} from "@/features/sheets/sheetDefinitionEditing";
import type { SheetResistancesPayload } from "@/infrastructure/ws/requestBuilders";
import { Field } from "@/shared/ui/Field";

export function SheetResistancesEditor({
  resistances,
  onSave,
  readOnly = false,
  title = readOnly ? "Resistances" : "Template Resistances"
}: {
  resistances: Resistances | undefined;
  onSave?: (resistances: SheetResistancesPayload) => void;
  readOnly?: boolean;
  title?: string;
}): JSX.Element {
  const [draft, setDraft] = useState<ResistancePercentDraft>(() =>
    toResistancePercentDraft(resistances)
  );

  useEffect(() => {
    setDraft(toResistancePercentDraft(resistances));
  }, [resistances]);

  const payload = parseResistancePercentDraft(draft);

  return (
    <section
      className={`template-editor stack ${readOnly ? "sheet-resistances--readonly" : ""}`}
    >
      <p className="template-editor__title">{title}</p>
      <p className="muted">
        {readOnly
          ? "Effective resistance combines total, category, and damage type, capped at 100%."
          : "Enter percentages from 0 to 100. Effective resistance combines total, category, and damage type, capped at 100%."}
      </p>
      <div className="character-sheet__core-blocks">
        {RESISTANCE_FIELDS.map(([key, label]) => (
          <Field label={`${label} (%)`} key={key}>
            {readOnly ? (
              <output className="sheet-resistance-readout">{draft[key]}%</output>
            ) : (
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={draft[key]}
                aria-invalid={payload === null}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
              />
            )}
          </Field>
        ))}
      </div>
      {!readOnly ? (
        <button
          type="button"
          className="button"
          disabled={!payload}
          onClick={() => {
            if (payload && onSave) {
              onSave(payload);
            }
          }}
        >
          Save Resistances
        </button>
      ) : null}
    </section>
  );
}
