import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import { buildSetSigilAuthoringAccessRequest } from "@/infrastructure/ws/requestBuilders";
import { makeId } from "@/shared/utils/id";

export function SigilPlayerAccess({ client }: { client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const { persistentSheets, sheets } = state.serverState;
  const players = Object.entries(persistentSheets).filter(([, instance]) => {
    const template = sheets[instance.parent_id];
    return template && !template.dm_only;
  });
  return (
    <fieldset className="sigil-player-access">
      <legend>Players who can create sigils</legend>
      <p>Select the player characters allowed to create and edit sigils.</p>
      {players.map(([id, instance]) => (
        <label key={id}>
          <input
            type="checkbox"
            checked={instance.can_inscribe_sigils ?? false}
            disabled={state.uiState.pendingIntentIds.length > 0}
            onChange={(event) =>
              client.sendProtocolRequest(
                buildSetSigilAuthoringAccessRequest(id, event.target.checked, makeId("request")),
                "Update sigil creation access"
              )
            }
          />
          {sheets[instance.parent_id].name} · {id}
        </label>
      ))}
      {!players.length && <p>No player characters have been created yet.</p>}
    </fieldset>
  );
}
