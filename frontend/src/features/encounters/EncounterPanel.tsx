import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { selectSheetTemplateViews } from "@/app/state/selectors";
import type { GameClient } from "@/hooks/useGameClient";
import type { EncounterPreset } from "@/domain/models";
import { EncounterEntryList } from "@/features/encounters/components/EncounterEntryList";
import { EncounterPresetList } from "@/features/encounters/components/EncounterPresetList";
import type { DraftEncounterEntry } from "@/features/encounters/encounterDraft";
import { newRosterEntry } from "@/features/encounters/encounterDraft";
import {
  buildDeleteEncounterPresetSubmission,
  buildSaveEncounterPresetSubmission,
  buildSpawnEncounterPresetSubmission
} from "@/features/encounters/encounterRequests";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { makeId } from "@/shared/utils/id";

export function EncounterPanel({ client }: { client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const { encounters, encounterOrder, sheets } = state.serverState;

  const [name, setName] = useState("");
  const [entries, setEntries] = useState<DraftEncounterEntry[]>([newRosterEntry()]);
  const [editingEncounterId, setEditingEncounterId] = useState<string | null>(null);

  const templateOptions = useMemo(
    () => selectSheetTemplateViews(state).filter((template) => template.kind === "enemy"),
    [state]
  );

  const savedEncounters = useMemo(
    () => encounterOrder.map((id) => encounters[id]).filter(Boolean),
    [encounterOrder, encounters]
  );

  const resetEditor = (): void => {
    setEditingEncounterId(null);
    setName("");
    setEntries([newRosterEntry()]);
  };

  useEffect(() => {
    if (editingEncounterId && !encounters[editingEncounterId]) {
      resetEditor();
    }
  }, [editingEncounterId, encounters]);

  const editEncounter = (encounter: EncounterPreset): void => {
    setEditingEncounterId(encounter.id);
    setName(encounter.name);
    setEntries(encounter.entries.map((entry) => newRosterEntry(entry.templateId, entry.count)));
  };

  const updateEntry = (entryId: string, changes: Partial<DraftEncounterEntry>): void => {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === entryId ? { ...entry, ...changes } : entry))
    );
  };

  const addEntry = (): void => {
    setEntries((prev) => [...prev, newRosterEntry()]);
  };

  const removeEntry = (entryId: string): void => {
    const entry = entries.find((candidate) => candidate.id === entryId);
    const template = entry?.templateId ? sheets[entry.templateId] : undefined;
    if (
      !confirmDestructiveAction({
        action: "Remove",
        subject: template?.name ?? "encounter roster entry",
        consequence: "This removes the entry from the encounter draft when you save it."
      })
    ) {
      return;
    }
    setEntries((prev) => {
      const next = prev.filter((entry) => entry.id !== entryId);
      return next.length > 0 ? next : [newRosterEntry()];
    });
  };

  const saveEncounter = (): void => {
    const validEntries = entries
      .filter((entry) => entry.templateId)
      .map((entry) => ({
        templateId: entry.templateId,
        count: Math.max(1, entry.count)
      }));

    if (!name.trim() || validEntries.length === 0) {
      return;
    }

    const submission = buildSaveEncounterPresetSubmission({
      id: editingEncounterId ?? makeId("encounter"),
      name: name.trim(),
      entries: validEntries,
      updatedAt: new Date().toISOString()
    });
    client.sendProtocolRequest(submission.request, submission.label);
    resetEditor();
  };

  const deleteEncounter = (encounter: EncounterPreset): void => {
    const submission = buildDeleteEncounterPresetSubmission(encounter);
    if (
      !confirmDestructiveAction({
        action: "Delete",
        subject: encounter.name,
        consequence: "This permanently deletes the encounter preset."
      })
    ) {
      return;
    }
    client.sendProtocolRequest(submission.request, submission.label);
  };

  return (
    <Panel
      title="Encounter Presets"
      subtitle="Save enemy groups ahead of time so you can spawn a whole encounter in one click."
    >
      <div className="stack">
        <Field label="Preset Name">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Cave Ambush"
          />
        </Field>

        <EncounterEntryList
          entries={entries}
          templateOptions={templateOptions}
          onChange={updateEntry}
          onRemove={removeEntry}
          onAdd={addEntry}
        />

        <div className="inline-actions">
          <button className="button" onClick={saveEncounter}>
            {editingEncounterId ? "Update Encounter" : "Save Encounter"}
          </button>
          {editingEncounterId ? (
            <button className="button button--secondary" onClick={resetEditor}>
              Cancel Edit
            </button>
          ) : null}
        </div>

        <EncounterPresetList
          encounters={savedEncounters}
          templates={sheets}
          onSpawn={(encounterId) => {
            const submission = buildSpawnEncounterPresetSubmission(encounterId);
            client.sendProtocolRequest(submission.request, submission.label);
          }}
          onEdit={editEncounter}
          onDelete={deleteEncounter}
        />
      </div>
    </Panel>
  );
}
