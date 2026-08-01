import type { TemplateEditorValues } from "@/features/sheets/templateEditorTypes";
import { Field } from "@/shared/ui/Field";

export function TemplateDetailsSection({
  values,
  validationAttempted = false,
  onChange
}: {
  values: TemplateEditorValues;
  validationAttempted?: boolean;
  onChange: (next: TemplateEditorValues) => void;
}): JSX.Element {
  const nameMissing = !values.name.trim();
  const racialHpMultiplier = Number(values.racialHpMultiplier);
  const racialHpMultiplierInvalid =
    !values.racialHpMultiplier.trim() ||
    !Number.isFinite(racialHpMultiplier) ||
    racialHpMultiplier <= 0;
  const xpAward = Number(values.xpGivenWhenSlayed);
  const xpAwardInvalid =
    values.kind === "enemy" &&
    (!values.xpGivenWhenSlayed.trim() || !Number.isFinite(xpAward) || xpAward < 0);

  return (
    <section className="template-builder__section stack" aria-labelledby="template-details-title">
      <div>
        <h3 id="template-details-title">Details</h3>
        <p className="muted">
          Name the template and choose who controls its created characters. This is the only
          required setup step. The racial HP multiplier is also required by the system rules.
        </p>
      </div>
      <div className="template-builder__details-grid">
        <Field label="Template Name" required invalid={validationAttempted && nameMissing}>
          <input
            value={values.name}
            onChange={(event) => onChange({ ...values, name: event.target.value })}
            placeholder="e.g. Orc Brute"
            required
            aria-invalid={validationAttempted && nameMissing}
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
        <Field
          label="Racial HP Multiplier"
          required
          invalid={validationAttempted && racialHpMultiplierInvalid}
        >
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={values.racialHpMultiplier}
            onChange={(event) => onChange({ ...values, racialHpMultiplier: event.target.value })}
            placeholder="e.g. 1 or 1.25"
            required
            aria-invalid={validationAttempted && racialHpMultiplierInvalid}
          />
        </Field>
        {values.kind === "enemy" ? (
          <Field
            label="XP Awarded When Slain"
            required
            invalid={validationAttempted && xpAwardInvalid}
          >
            <input
              type="number"
              min="0"
              step="1"
              value={values.xpGivenWhenSlayed}
              required
              aria-invalid={validationAttempted && xpAwardInvalid}
              onChange={(event) => onChange({ ...values, xpGivenWhenSlayed: event.target.value })}
            />
          </Field>
        ) : (
          <Field label="XP Needed For Next Level (Optional)">
            <input
              value={values.xpCap}
              onChange={(event) => onChange({ ...values, xpCap: event.target.value })}
              placeholder="e.g. 100"
            />
          </Field>
        )}
      </div>
      <Field label="GM Reference Notes (Optional)">
        <textarea
          value={values.notes}
          onChange={(event) => onChange({ ...values, notes: event.target.value })}
          rows={6}
          placeholder="Role, tactics, or reminders for using this template at the table."
        />
      </Field>
    </section>
  );
}
