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
  onSave
}: {
  resistances: Resistances | undefined;
  onSave: (resistances: SheetResistancesPayload) => void;
}): JSX.Element {
  const [draft, setDraft] = useState<ResistancePercentDraft>(() =>
    toResistancePercentDraft(resistances)
  );

  useEffect(() => {
    setDraft(toResistancePercentDraft(resistances));
  }, [resistances]);

  const payload = parseResistancePercentDraft(draft);

  return (
    <section className="template-editor stack">
      <p className="template-editor__title">Template Resistances</p>
      <p className="muted">
        Enter percentages from 0 to 100. Effective resistance combines total, category, and damage
        type, capped at 100%.
      </p>
      <div className="character-sheet__core-blocks">
        {RESISTANCE_FIELDS.map(([key, label]) => (
          <Field label={`${label} (%)`} key={key}>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={draft[key]}
              aria-invalid={payload === null}
              onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
            />
          </Field>
        ))}
      </div>
      <button
        type="button"
        className="button"
        disabled={!payload}
        onClick={() => {
          if (payload) {
            onSave(payload);
          }
        }}
      >
        Save Resistances
      </button>
    </section>
  );
}
