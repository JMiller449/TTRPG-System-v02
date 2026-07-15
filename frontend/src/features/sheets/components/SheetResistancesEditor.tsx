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

const CORE_RESISTANCE_FIELDS = RESISTANCE_FIELDS.slice(0, 3);
const DAMAGE_TYPE_RESISTANCE_FIELDS = RESISTANCE_FIELDS.slice(3);

function ResistanceReadout({ label, value }: { label: string; value: string }): JSX.Element {
  const percentage = Math.min(100, Math.max(0, Number(value) || 0));

  return (
    <article className="sheet-resistance-card">
      <div className="sheet-resistance-card__header">
        <span>{label}</span>
        <output>
          {value}
          <small>%</small>
        </output>
      </div>
      <div className="sheet-resistance-card__track" aria-hidden="true">
        <span style={{ width: `${percentage}%` }} />
      </div>
    </article>
  );
}

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

  const resistanceControl = ([key, label]: (typeof RESISTANCE_FIELDS)[number]): JSX.Element =>
    readOnly ? (
      <ResistanceReadout key={key} label={label} value={draft[key]} />
    ) : (
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
    );

  return (
    <section
      className={`template-editor stack sheet-resistances ${
        readOnly ? "sheet-resistances--readonly" : "sheet-resistances--editable"
      }`}
    >
      <header className="sheet-resistances__header">
        <div>
          <span className="sheet-resistances__eyebrow">Defense profile</span>
          <h3>{title}</h3>
        </div>
        <p className="muted">
          {readOnly
            ? "Effective resistance combines total, category, and damage type, capped at 100%."
            : "Enter percentages from 0 to 100. Effective resistance combines total, category, and damage type, capped at 100%."}
        </p>
      </header>
      <section className="sheet-resistance-group" aria-labelledby="core-resistances-title">
        <div className="sheet-resistance-group__heading">
          <h4 id="core-resistances-title">Core modifiers</h4>
          <p className="muted">Overall, physical, and magical reductions.</p>
        </div>
        <div className="sheet-resistance-grid sheet-resistance-grid--core">
          {CORE_RESISTANCE_FIELDS.map(resistanceControl)}
        </div>
      </section>
      <section className="sheet-resistance-group" aria-labelledby="damage-resistances-title">
        <div className="sheet-resistance-group__heading">
          <h4 id="damage-resistances-title">Damage types</h4>
          <p className="muted">Specific reductions applied by damage type.</p>
        </div>
        <div className="sheet-resistance-grid sheet-resistance-grid--types">
          {DAMAGE_TYPE_RESISTANCE_FIELDS.map(resistanceControl)}
        </div>
      </section>
      {!readOnly ? (
        <button
          type="button"
          className="button sheet-resistances__save"
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
