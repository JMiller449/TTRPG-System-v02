import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
import type { SheetTemplate } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";
import type { GameClient } from "@/hooks/useGameClient";

interface DraftEncounterEntry {
  id: string;
  templateId: string;
  count: number;
}

function newRosterEntry(): DraftEncounterEntry {
  return { id: makeId("entry"), templateId: "", count: 1 };
}

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

    client.sendIntent({
      intentId: makeId("intent"),
      type: "save_encounter",
      payload: {
        encounter: {
          id: makeId("encounter"),
          name: name.trim(),
          entries: validEntries,
          updatedAt: new Date().toISOString()
        }
      }
    });

    setName("");
    setEntries([newRosterEntry()]);
  };

  return (
    <Panel title="Encounter Presets">
      <div className="stack">
        <Field label="Preset Name">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Cave Ambush" />
        </Field>

        <div className="stack">
          <strong>Roster Entries</strong>
          {entries.map((entry, index) => (
            <div key={entry.id} className="inline-group encounter-entry-row">
              <Field label={`Enemy Template ${index + 1}`}>
                <select
                  value={entry.templateId}
                  onChange={(event) => updateEntry(entry.id, { templateId: event.target.value })}
                >
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
                  onChange={(event) => updateEntry(entry.id, { count: Number(event.target.value) || 1 })}
                />
              </Field>
              <div className="encounter-entry-row__actions">
                <button className="button button--secondary" onClick={() => removeEntry(entry.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button className="button button--secondary" onClick={addEntry}>
            Add Roster Entry
          </button>
        </div>

        <button className="button" onClick={saveEncounter}>
          Save Encounter
        </button>

        <div className="list">
          {encounterOrder.length === 0 ? <EmptyState message="No saved encounters." /> : null}
          {encounterOrder.map((id) => {
            const encounter = encounters[id];
            return (
              <article key={id} className="list-item">
                <div>
                  <strong>{encounter.name}</strong>
                  <div className="muted">
                    {encounter.entries.map((entry) => `${entry.count}x ${templates[entry.templateId]?.name ?? entry.templateId}`).join(
                      ", "
                    )}
                  </div>
                </div>
                <button
                  className="button button--secondary"
                  onClick={() =>
                    client.sendIntent({
                      intentId: makeId("intent"),
                      type: "spawn_encounter",
                      payload: { encounterId: encounter.id }
                    })
                  }
                >
                  Spawn
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
