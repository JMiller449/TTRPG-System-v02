import { useState } from "react";
import { useAppStore } from "@/app/state/store";
import { selectPlayerInstances } from "@/app/state/selectors";
import type { Sheet } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildCreateSheetIntent,
  buildInstantiateSheetIntent,
  buildSetActiveSheetIntent
} from "@/features/sheets/intentBuilders";
import { createDefaultStats } from "@/features/sheets/templateEditorValues";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

export function PlayerEntry({ client }: { client: GameClient }): JSX.Element {
  const { state, dispatch } = useAppStore();

  const [selectedSheetId, setSelectedSheetId] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");

  const playerInstances = selectPlayerInstances(state);

  const continueWithSelected = (): void => {
    if (!selectedSheetId) {
      return;
    }
    dispatch({ type: "set_player_sheet_selection_complete", value: true });
    client.sendIntent(buildSetActiveSheetIntent(selectedSheetId));
  };

  const createNewPlayer = (): void => {
    const name = newPlayerName.trim();
    if (!name) {
      return;
    }

    const templateId = makeId("template_player");
    const sheet: Sheet = {
      id: templateId,
      name,
      dm_only: false,
      xp_given_when_slayed: 0,
      xp_cap: "",
      proficiencies: {},
      items: {},
      stats: createDefaultStats(),
      slayed_record: {},
      actions: {}
    };

    dispatch({ type: "set_player_sheet_selection_complete", value: true });
    client.sendIntent(
      buildCreateSheetIntent(sheet, {
        kind: "player",
        notes: "",
        tags: ["player", "custom"],
        updatedAt: new Date().toISOString()
      })
    );
    client.sendIntent(buildInstantiateSheetIntent(templateId, 1));

    setNewPlayerName("");
  };

  return (
    <div className="landing-shell">
      <div className="landing-card">
        <h1>Select Character Sheet</h1>
        <p className="muted">Choose a player character sheet before entering the player console.</p>

        <Panel title="Available Character Sheets">
          <div className="stack">
            {playerInstances.length === 0 ? (
              <EmptyState message="No player sheets found. Create one below." />
            ) : (
              <Field label="Character Sheet">
                <select value={selectedSheetId} onChange={(event) => setSelectedSheetId(event.target.value)}>
                  <option value="">Select character sheet...</option>
                  {playerInstances.map((sheet) => (
                    <option key={sheet.id} value={sheet.id}>
                      {sheet.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <button className="button" onClick={continueWithSelected} disabled={!selectedSheetId}>
              Open Character Sheet
            </button>
          </div>
        </Panel>

        <Panel title="Create New Character Sheet">
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
