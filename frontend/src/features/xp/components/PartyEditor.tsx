import { useEffect, useState } from "react";
import type { GameClient } from "@/hooks/useGameClient";
import type { XpTrackerPartyEvent } from "@/generated/backendProtocol";
import {
  buildDeletePartyRequest,
  buildSavePartyRequest
} from "@/infrastructure/ws/requestBuilders";

export function PartyEditor({
  party,
  characters,
  unavailableIds,
  client
}: {
  party: XpTrackerPartyEvent;
  characters: { instance_id: string; name: string }[];
  unavailableIds: Set<string>;
  client: GameClient;
}): JSX.Element {
  const [name, setName] = useState(party.name);
  const [members, setMembers] = useState(() => party.members.map((member) => member.instance_id));

  useEffect(() => {
    setName(party.name);
    setMembers(party.members.map((member) => member.instance_id));
  }, [party]);

  return (
    <article className="xp-party-editor">
      <div className="xp-party-editor__header">
        <input
          aria-label="Party name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          className="button button--danger"
          type="button"
          onClick={() =>
            client.sendProtocolRequest(
              buildDeletePartyRequest({ partyId: party.id }),
              `Delete party: ${party.name}`
            )
          }
        >
          Delete
        </button>
      </div>
      <div className="xp-member-grid">
        {characters.map((character) => {
          const checked = members.includes(character.instance_id);
          return (
            <label key={character.instance_id}>
              <input
                type="checkbox"
                checked={checked}
                disabled={!checked && unavailableIds.has(character.instance_id)}
                onChange={() =>
                  setMembers((current) =>
                    checked
                      ? current.filter((id) => id !== character.instance_id)
                      : [...current, character.instance_id]
                  )
                }
              />
              {character.name}
            </label>
          );
        })}
      </div>
      <button
        className="button button--primary"
        type="button"
        disabled={!name.trim()}
        onClick={() =>
          client.sendProtocolRequest(
            buildSavePartyRequest({
              partyId: party.id,
              name: name.trim(),
              memberInstanceIds: members
            }),
            `Save party: ${name}`
          )
        }
      >
        Save Party
      </button>
    </article>
  );
}
