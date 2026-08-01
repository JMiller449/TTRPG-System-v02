import type { SheetTemplateView } from "@/domain/models";
import type { DraftEncounterEntry } from "@/features/encounters/encounterDraft";
import { EncounterEntryRow } from "@/features/encounters/components/EncounterEntryRow";

export function EncounterEntryList({
  entries,
  templateOptions,
  validationAttempted = false,
  onChange,
  onRemove,
  onAdd
}: {
  entries: DraftEncounterEntry[];
  templateOptions: SheetTemplateView[];
  validationAttempted?: boolean;
  onChange: (entryId: string, changes: Partial<DraftEncounterEntry>) => void;
  onRemove: (entryId: string) => void;
  onAdd: () => void;
}): JSX.Element {
  return (
    <div className="stack">
      <strong>
        Roster Entries
        <span className="field__required-marker" aria-hidden="true">
          *
        </span>
        <span className="r6-sr-only"> (at least one required)</span>
      </strong>
      <span className="muted">Choose at least one enemy template.</span>
      {entries.map((entry, index) => (
        <EncounterEntryRow
          key={entry.id}
          entry={entry}
          index={index}
          templateOptions={templateOptions}
          invalid={
            validationAttempted && !entries.some((candidate) => Boolean(candidate.templateId))
          }
          onChange={onChange}
          onRemove={onRemove}
        />
      ))}
      <button className="button button--secondary" onClick={onAdd}>
        Add Roster Entry
      </button>
    </div>
  );
}
