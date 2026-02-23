import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
import type { SheetTemplate } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { EncounterEntryList } from "@/features/encounters/components/EncounterEntryList";
import { EncounterPresetList } from "@/features/encounters/components/EncounterPresetList";
import type { DraftEncounterEntry } from "@/features/encounters/encounterDraft";
import { newRosterEntry } from "@/features/encounters/encounterDraft";
import {
  buildSaveEncounterIntent,
  buildSpawnEncounterIntent
} from "@/features/encounters/intentBuilders";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

export function EncounterPanel({ client }: { client: GameClient }): JSX.Element {
  const {
    state: { templates, templateOrder, encounters, encounterOrder }
  } = useAppStore();

  const [name, setName] = useState("");
  const [entries, setEntries] = useState<DraftEncounterEntry[]>([newRosterEntry()]);

  const templateOptions = useMemo(
    () =>
      templateOrder
        .map((id) => templates[id])
        .filter((template): template is SheetTemplate => Boolean(template))
        .filter((template) => template.kind === "enemy"),
    [templateOrder, templates]
  );

  const savedEncounters = useMemo(
    () => encounterOrder.map((id) => encounters[id]).filter(Boolean),
    [encounterOrder, encounters]
  );

  const updateEntry = (entryId: string, changes: Partial<DraftEncounterEntry>): void => {
    setEntries((prev) => prev.map((entry) => (entry.id === entryId ? { ...entry, ...changes } : entry)));
  };

  const addEntry = (): void => {
    setEntries((prev) => [...prev, newRosterEntry()]);
  };

  const removeEntry = (entryId: string): void => {
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

    client.sendIntent(
      buildSaveEncounterIntent({
        id: makeId("encounter"),
        name: name.trim(),
        entries: validEntries,
        updatedAt: new Date().toISOString()
      })
    );

    setName("");
    setEntries([newRosterEntry()]);
  };

  return (
    <Panel title="Encounter Presets">
      <div className="stack">
        <Field label="Preset Name">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Cave Ambush" />
        </Field>

        <EncounterEntryList
          entries={entries}
          templateOptions={templateOptions}
          onChange={updateEntry}
          onRemove={removeEntry}
          onAdd={addEntry}
        />

        <button className="button" onClick={saveEncounter}>
          Save Encounter
        </button>

        <EncounterPresetList
          encounters={savedEncounters}
          templates={templates}
          onSpawn={(encounterId) => client.sendIntent(buildSpawnEncounterIntent(encounterId))}
        />
      </div>
    </Panel>
  );
}
