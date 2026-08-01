import { useCallback, useEffect, useMemo, useState } from "react";
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
import { FormValidationSummary } from "@/shared/ui/FormValidationSummary";
import { useFormValidationAttempt } from "@/shared/ui/useFormValidationAttempt";

export function EncounterPanel({ client }: { client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const { encounters, encounterOrder, sheets } = state.serverState;

  const [name, setName] = useState("");
  const [entries, setEntries] = useState<DraftEncounterEntry[]>([newRosterEntry()]);
  const [editingEncounterId, setEditingEncounterId] = useState<string | null>(null);
  const validation = useFormValidationAttempt();

  const templateOptions = useMemo(
    () => selectSheetTemplateViews(state).filter((template) => template.kind === "enemy"),
    [state]
  );

  const savedEncounters = useMemo(
    () => encounterOrder.map((id) => encounters[id]).filter(Boolean),
    [encounterOrder, encounters]
  );

  const resetEditor = useCallback((): void => {
    validation.reset();
    setEditingEncounterId(null);
    setName("");
    setEntries([newRosterEntry()]);
  }, [validation]);

  useEffect(() => {
    if (editingEncounterId && !encounters[editingEncounterId]) {
      resetEditor();
    }
  }, [editingEncounterId, encounters, resetEditor]);

  const editEncounter = (encounter: EncounterPreset): void => {
    validation.reset();
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

    if (!validation.validate(Boolean(name.trim()) && validEntries.length > 0)) {
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
        <Field label="Preset Name" required invalid={validation.attempted && !name.trim()}>
          <input
            value={name}
            required
            aria-invalid={validation.attempted && !name.trim()}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Cave Ambush"
          />
        </Field>

        <EncounterEntryList
          entries={entries}
          templateOptions={templateOptions}
          validationAttempted={validation.attempted}
          onChange={updateEntry}
          onRemove={removeEntry}
          onAdd={addEntry}
        />

        <FormValidationSummary
          visible={
            validation.attempted &&
            (!name.trim() || !entries.some((entry) => Boolean(entry.templateId)))
          }
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
