import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
import type { SheetInstance, SheetTemplate } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

export function PlayerEntry({ client }: { client: GameClient }): JSX.Element {
  const {
    state: { instances, instanceOrder },
    dispatch
  } = useAppStore();

  const [selectedSheetId, setSelectedSheetId] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");

  const playerInstances = useMemo(
    () =>
      instanceOrder
        .map((id) => instances[id])
        .filter((entry): entry is SheetInstance => Boolean(entry) && entry.kind === "player"),
    [instanceOrder, instances]
  );

  const continueWithSelected = (): void => {
    if (!selectedSheetId) {
      return;
    }
    client.sendIntent({
      intentId: makeId("intent"),
      type: "set_active_sheet",
      payload: { sheetId: selectedSheetId }
    });
  };

  const createNewPlayer = (): void => {
    const name = newPlayerName.trim();
    if (!name) {
      return;
    }

    const templateId = makeId("template_player");
    const template: SheetTemplate = {
      id: templateId,
      kind: "player",
      mode: "template",
      name,
      notes: "",
      stats: {},
      tags: ["player", "custom"],
      updatedAt: new Date().toISOString()
    };

    client.sendIntent({
      intentId: makeId("intent"),
      type: "create_template",
      payload: { template }
    });

    client.sendIntent({
      intentId: makeId("intent"),
      type: "instantiate_template",
      payload: { templateId, count: 1 }
    });

    setNewPlayerName("");
  };

  return (
    <div className="landing-shell">
      <div className="landing-card">
        <h1>Player Entry</h1>
        <p className="muted">Select an existing player sheet or create a new player before entering the console.</p>

        <Panel title="Select Existing Player">
          <div className="stack">
            {playerInstances.length === 0 ? (
              <EmptyState message="No player sheets found. Create one below." />
            ) : (
              <Field label="Player Sheet">
                <select value={selectedSheetId} onChange={(event) => setSelectedSheetId(event.target.value)}>
                  <option value="">Select player sheet...</option>
                  {playerInstances.map((sheet) => (
                    <option key={sheet.id} value={sheet.id}>
                      {sheet.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <button className="button" onClick={continueWithSelected} disabled={!selectedSheetId}>
              Enter Player Console
            </button>
          </div>
        </Panel>

        <Panel title="Create New Player">
          <div className="stack">
            <Field label="Player Name">
              <input
                value={newPlayerName}
                onChange={(event) => setNewPlayerName(event.target.value)}
                placeholder="e.g. Mira"
              />
            </Field>

            <button className="button" onClick={createNewPlayer} disabled={!newPlayerName.trim()}>
              Create Player
            </button>
          </div>
        </Panel>

        <div className="landing-actions">
          <button
            className="button button--secondary"
            onClick={() => {
              dispatch({ type: "set_gm_view", view: "console" });
              dispatch({ type: "set_role", role: null });
            }}
          >
            Back to Session Landing
          </button>
        </div>
      </div>
    </div>
  );
}
