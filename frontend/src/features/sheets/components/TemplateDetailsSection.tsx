import type { TemplateEditorValues } from "@/features/sheets/templateEditorTypes";
import { Field } from "@/shared/ui/Field";

export function TemplateDetailsSection({
  values,
  onChange
}: {
  values: TemplateEditorValues;
  onChange: (next: TemplateEditorValues) => void;
}): JSX.Element {
  return (
    <section className="template-builder__section stack" aria-labelledby="template-details-title">
      <div>
        <h3 id="template-details-title">Details</h3>
        <p className="muted">Identity, table control, notes, and XP bookkeeping.</p>
      </div>
      <div className="template-builder__details-grid">
        <Field label="Template Name">
          <input
            value={values.name}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
            placeholder="e.g. Orc Brute"
            required
          />
        </Field>
        <Field label="Control Mode">
          <select
            value={values.kind}
            onChange={(event) =>
              onChange({ ...values, kind: event.target.value as TemplateEditorValues["kind"] })
            }
          >
            <option value="player">Player-controlled</option>
            <option value="enemy">GM-controlled</option>
          </select>
        </Field>
        <Field label="XP Awarded When Slain">
          <input
            type="number"
            min="0"
            step="1"
            value={values.xpGivenWhenSlayed}
            onChange={(event) => onChange({ ...values, xpGivenWhenSlayed: event.target.value })}
          />
        </Field>
        <Field label="XP Needed For Next Level">
          <input
            value={values.xpCap}
            onChange={(event) => onChange({ ...values, xpCap: event.target.value })}
            placeholder="e.g. 100"
          />
        </Field>
      </div>
      <Field label="Notes">
        <textarea
          value={values.notes}
          onChange={(event) => onChange({ ...values, notes: event.target.value })}
          rows={6}
          placeholder="GM reference notes for this template."
        />
      </Field>
    </section>
  );
}
