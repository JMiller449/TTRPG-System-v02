import type { ChangeEvent } from "react";
import {
  CORE_STAT_LABELS,
  CORE_TEMPLATE_STATS,
  type CoreTemplateStatKey,
  type TemplateEditorValues
} from "@/features/sheets/templateEditorTypes";
import { Field } from "@/shared/ui/Field";

interface TemplateEditorFormProps {
  title: string;
  submitLabel: string;
  values: TemplateEditorValues;
  onChange: (next: TemplateEditorValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}

export function TemplateEditorForm({
  title,
  submitLabel,
  values,
  onChange,
  onSubmit,
  onCancel
}: TemplateEditorFormProps): JSX.Element {
  const updateCoreStat =
    (key: CoreTemplateStatKey) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      onChange({
        ...values,
        coreStats: {
          ...values.coreStats,
          [key]: event.target.value
        }
      });
    };

  return (
    <section className="template-editor">
      <h3 className="template-editor__title">{title}</h3>
      <div className="stack">
        <div className="inline-group">
          <Field label="Template Name">
            <input
              value={values.name}
              onChange={(event) => onChange({ ...values, name: event.target.value })}
              placeholder="e.g. Orc Brute"
            />
          </Field>
          <Field label="Kind">
            <select
              value={values.kind}
              onChange={(event) => onChange({ ...values, kind: event.target.value as TemplateEditorValues["kind"] })}
            >
              <option value="player">Player</option>
              <option value="enemy">Enemy</option>
            </select>
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={values.notes}
            onChange={(event) => onChange({ ...values, notes: event.target.value })}
            rows={3}
            placeholder="Reference notes for this template."
          />
        </Field>

        <div className="template-editor__stats">
          {CORE_TEMPLATE_STATS.map((key) => (
            <Field key={key} label={CORE_STAT_LABELS[key]}>
              <input
                type="number"
                value={values.coreStats[key]}
                onChange={updateCoreStat(key)}
                placeholder="0"
              />
            </Field>
          ))}
        </div>

        <div className="template-editor__actions">
          <button className="button" onClick={onSubmit}>
            {submitLabel}
          </button>
          {onCancel ? (
            <button className="button button--secondary" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
        <p className="muted">
          Core stats are scaffold inputs only. TODO: backend schema will define substat/resource derivation rules.
        </p>
      </div>
    </section>
  );
}
