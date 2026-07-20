import { useEffect, useState } from "react";
import type { GameClient } from "@/hooks/useGameClient";
import type { XpTrackerPartyEvent } from "@/generated/backendProtocol";
import {
  buildDeletePartyRequest,
  buildSavePartyRequest
} from "@/infrastructure/ws/requestBuilders";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";

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
  const [characterToAdd, setCharacterToAdd] = useState("");
  const savedMemberIdSet = new Set(party.members.map((member) => member.instance_id));
  const memberCharacters = members
    .map((instanceId) => characters.find((character) => character.instance_id === instanceId))
    .filter((character): character is { instance_id: string; name: string } => Boolean(character));
  const availableCharacters = characters.filter(
    (character) =>
      !members.includes(character.instance_id) &&
      (!unavailableIds.has(character.instance_id) || savedMemberIdSet.has(character.instance_id))
  );
  const savedMemberIds = party.members.map((member) => member.instance_id).sort();
  const currentMemberIds = [...members].sort();
  const isDirty =
    name.trim() !== party.name ||
    currentMemberIds.some((memberId, index) => memberId !== savedMemberIds[index]) ||
    currentMemberIds.length !== savedMemberIds.length;

  useEffect(() => {
    setName(party.name);
    setMembers(party.members.map((member) => member.instance_id));
    setCharacterToAdd("");
  }, [party]);

  return (
    <article className="xp-party-editor" aria-label={`Party folder ${party.name}`}>
      <div className="xp-party-editor__header">
        <div>
          <label htmlFor={`party-name-${party.id}`}>Folder name</label>
          <input
            id={`party-name-${party.id}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <button
          className="button button--danger"
          type="button"
          onClick={() => {
            if (
              !confirmDestructiveAction({
                action: "Delete",
                subject: party.name,
                consequence:
                  "This deletes the party folder and leaves its characters unassigned. Historical XP records are unchanged."
              })
            ) {
              return;
            }
            client.sendProtocolRequest(
              buildDeletePartyRequest({ partyId: party.id }),
              `Delete party: ${party.name}`
            );
          }}
        >
          Delete
        </button>
      </div>
      <div className="xp-party-editor__summary">
        <div>
          <strong>{memberCharacters.length}</strong>
          <span>{memberCharacters.length === 1 ? "character" : "characters"}</span>
        </div>
        <small>Party membership controls XP participation for new kills.</small>
      </div>
      {memberCharacters.length === 0 ? (
        <p className="empty-state">This party has no characters.</p>
      ) : (
        <ul className="xp-character-roster">
          {memberCharacters.map((character) => (
            <li key={character.instance_id}>
              <div>
                <strong>{character.name}</strong>
                <small>{character.instance_id}</small>
              </div>
              <button
                className="button button--secondary"
                type="button"
                aria-label={`Remove ${character.name} from ${party.name}`}
                onClick={() => {
                  if (
                    !confirmDestructiveAction({
                      action: "Remove",
                      subject: character.name,
                      consequence:
                        "This removes the character from this party when you save the folder."
                    })
                  ) {
                    return;
                  }
                  setMembers((current) =>
                    current.filter((instanceId) => instanceId !== character.instance_id)
                  );
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="xp-party-editor__add">
        <label htmlFor={`party-character-${party.id}`}>Add unassigned character</label>
        <div>
          <select
            id={`party-character-${party.id}`}
            value={characterToAdd}
            disabled={availableCharacters.length === 0}
            onChange={(event) => setCharacterToAdd(event.target.value)}
          >
            <option value="">
              {availableCharacters.length === 0 ? "No unassigned characters" : "Select character"}
            </option>
            {availableCharacters.map((character) => (
              <option key={character.instance_id} value={character.instance_id}>
                {character.name}
              </option>
            ))}
          </select>
          <button
            className="button button--secondary"
            type="button"
            disabled={!characterToAdd}
            onClick={() => {
              if (!characterToAdd) return;
              setMembers((current) => [...current, characterToAdd]);
              setCharacterToAdd("");
            }}
          >
            Add Character
          </button>
        </div>
      </div>
      <footer className="xp-party-editor__footer">
        <span>{isDirty ? "Unsaved changes" : "All changes saved"}</span>
        <button
          className="button button--primary"
          type="button"
          disabled={!name.trim() || !isDirty}
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
      </footer>
    </article>
  );
}
