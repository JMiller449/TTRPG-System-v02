import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { EncounterPreset } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { buildSpawnEncounterPresetSubmission } from "@/features/encounters/encounterRequests";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";

export function EncounterQuickSelectPanel({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      serverState: { encounters, encounterOrder, sheets }
    }
  } = useAppStore();

  const [selectedEncounterId, setSelectedEncounterId] = useState("");

  const encounterOptions = useMemo(
    () =>
      encounterOrder
        .map((id) => encounters[id])
        .filter((entry): entry is EncounterPreset => Boolean(entry)),
    [encounterOrder, encounters]
  );

  const selectedEncounter = selectedEncounterId ? encounters[selectedEncounterId] : null;

  const spawnSelected = (): void => {
    if (!selectedEncounterId) {
      return;
    }
    const submission = buildSpawnEncounterPresetSubmission(selectedEncounterId);
    client.sendProtocolRequest(submission.request, submission.label);
  };

  return (
    <Panel title="Encounter Quick Select">
      <div className="stack">
        {encounterOptions.length === 0 ? (
          <EmptyState message="No encounter presets found. Create them from the Encounter Presets page." />
        ) : (
          <>
            <Field label="Preset">
              <select value={selectedEncounterId} onChange={(event) => setSelectedEncounterId(event.target.value)}>
                <option value="">Select preset...</option>
                {encounterOptions.map((encounter) => (
                  <option key={encounter.id} value={encounter.id}>
                    {encounter.name}
                  </option>
                ))}
              </select>
            </Field>

            {selectedEncounter ? (
              <p className="muted">
                {selectedEncounter.entries
                  .map((entry) => `${entry.count}x ${sheets[entry.templateId]?.name ?? entry.templateId}`)
                  .join(", ")}
              </p>
            ) : null}

            <button className="button" onClick={spawnSelected} disabled={!selectedEncounterId}>
              Spawn Selected Preset
            </button>
          </>
        )}
      </div>
    </Panel>
  );
}
