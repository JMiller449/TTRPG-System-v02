import type { SheetTemplate } from "@/domain/models";
import type { DraftEncounterEntry } from "@/features/encounters/encounterDraft";
import { Field } from "@/shared/ui/Field";

export function EncounterEntryRow({
  entry,
  index,
  templateOptions,
  onChange,
  onRemove
}: {
  entry: DraftEncounterEntry;
  index: number;
  templateOptions: SheetTemplate[];
  onChange: (entryId: string, changes: Partial<DraftEncounterEntry>) => void;
  onRemove: (entryId: string) => void;
}): JSX.Element {
  return (
    <div className="inline-group encounter-entry-row">
      <Field label={`Enemy Template ${index + 1}`}>
        <select value={entry.templateId} onChange={(event) => onChange(entry.id, { templateId: event.target.value })}>
          <option value="">Select template</option>
          {templateOptions.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Count">
        <input
          type="number"
          min={1}
          value={entry.count}
          onChange={(event) => onChange(entry.id, { count: Number(event.target.value) || 1 })}
        />
      </Field>

      <div className="encounter-entry-row__actions">
        <button className="button button--secondary" onClick={() => onRemove(entry.id)}>
          Remove
        </button>
      </div>
    </div>
  );
}
