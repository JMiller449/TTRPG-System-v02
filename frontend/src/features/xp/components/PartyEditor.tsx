import { useEffect, useState } from "react";
import type { GameClient } from "@/hooks/useGameClient";
import type { XpTrackerPartyEvent } from "@/generated/backendProtocol";
import {
  buildDeletePartyRequest,
  buildSavePartyRequest
} from "@/infrastructure/ws/requestBuilders";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { CatalogEntityMultiSelect } from "@/features/catalogs/CatalogEntityMultiSelect";

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
  const savedMemberIdSet = new Set(party.members.map((member) => member.instance_id));
  const selectableCharacters = characters.filter(
    (character) =>
      !unavailableIds.has(character.instance_id) || savedMemberIdSet.has(character.instance_id)
  );
  const savedMemberIds = party.members.map((member) => member.instance_id).sort();
  const currentMemberIds = [...members].sort();
  const isDirty =
    name.trim() !== party.name ||
    currentMemberIds.some((memberId, index) => memberId !== savedMemberIds[index]) ||
    currentMemberIds.length !== savedMemberIds.length;
  const updateMembers = (nextMembers: string[]): void => {
    const removedIds = members.filter((instanceId) => !nextMembers.includes(instanceId));
    if (removedIds.length > 0) {
      const removedNames = removedIds.map(
        (instanceId) =>
          characters.find((character) => character.instance_id === instanceId)?.name ?? instanceId
      );
      if (
        !confirmDestructiveAction({
          action: "Remove",
          subject:
            removedNames.length === 1
              ? (removedNames[0] ?? "character")
              : `${removedNames.length} characters`,
          consequence:
            removedNames.length === 1
              ? "This removes the character from this party when you save the party."
              : "This removes the selected characters from this party when you save the party."
        })
      ) {
        return;
      }
    }
    setMembers(nextMembers);
  };

  useEffect(() => {
    setName(party.name);
    setMembers(party.members.map((member) => member.instance_id));
  }, [party]);

  return (
    <article className="xp-party-editor" aria-label={`Party ${party.name}`}>
      <div className="xp-party-editor__header">
        <div>
          <label htmlFor={`party-name-${party.id}`}>Party name</label>
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
                  "This deletes the party and leaves its characters unassigned. Historical XP records are unchanged."
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
      <CatalogEntityMultiSelect
        catalog="sheet_instances"
        label="Party members"
        options={selectableCharacters.map((character) => ({
          id: character.instance_id,
          label: character.name,
          secondary: character.instance_id
        }))}
        selectedIds={members}
        onChange={updateMembers}
      />
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
