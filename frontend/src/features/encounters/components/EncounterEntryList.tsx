import type { SheetTemplate } from "@/domain/models";
import type { DraftEncounterEntry } from "@/features/encounters/encounterDraft";
import { EncounterEntryRow } from "@/features/encounters/components/EncounterEntryRow";

export function EncounterEntryList({
  entries,
  templateOptions,
  onChange,
  onRemove,
  onAdd
}: {
  entries: DraftEncounterEntry[];
  templateOptions: SheetTemplate[];
  onChange: (entryId: string, changes: Partial<DraftEncounterEntry>) => void;
  onRemove: (entryId: string) => void;
  onAdd: () => void;
}): JSX.Element {
  return (
    <div className="stack">
      <strong>Roster Entries</strong>
      {entries.map((entry, index) => (
        <EncounterEntryRow
          key={entry.id}
          entry={entry}
          index={index}
          templateOptions={templateOptions}
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
