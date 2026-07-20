import { useEffect, useMemo, useState } from "react";
import type { XpTrackerPartyEvent, XpTrackerSheetEvent } from "@/generated/backendProtocol";
import { PartyEditor } from "@/features/xp/components/PartyEditor";
import type { GameClient } from "@/hooks/useGameClient";
import { EmptyState } from "@/shared/ui/EmptyState";

const UNASSIGNED_FOLDER_ID = "unassigned";

export function PartyFolderWorkspace({
  parties,
  characters,
  client
}: {
  parties: XpTrackerPartyEvent[];
  characters: XpTrackerSheetEvent[];
  client: GameClient;
}): JSX.Element {
  const [selectedFolderId, setSelectedFolderId] = useState(parties[0]?.id ?? UNASSIGNED_FOLDER_ID);
  const [unassignedFilter, setUnassignedFilter] = useState("");
  const assignedIds = useMemo(
    () => new Set(parties.flatMap((party) => party.members.map((member) => member.instance_id))),
    [parties]
  );
  const selectedParty = parties.find((party) => party.id === selectedFolderId) ?? null;
  const unassignedCharacters = characters.filter(
    (character) => !assignedIds.has(character.instance_id)
  );
  const filteredUnassignedCharacters = unassignedCharacters.filter((character) =>
    character.name.toLocaleLowerCase().includes(unassignedFilter.trim().toLocaleLowerCase())
  );

  useEffect(() => {
    if (
      selectedFolderId !== UNASSIGNED_FOLDER_ID &&
      !parties.some((party) => party.id === selectedFolderId)
    ) {
      setSelectedFolderId(parties[0]?.id ?? UNASSIGNED_FOLDER_ID);
    }
  }, [parties, selectedFolderId]);

  return (
    <div className="xp-party-folders">
      <nav className="xp-party-folder-nav" aria-label="Character party folders">
        <div className="xp-party-folder-nav__heading">
          <h3>Character Folders</h3>
          <small>{characters.length} spawned characters</small>
        </div>
        <div className="xp-party-folder-nav__list">
          {parties.map((party) => (
            <button
              key={party.id}
              type="button"
              className={selectedFolderId === party.id ? "is-active" : ""}
              aria-pressed={selectedFolderId === party.id}
              onClick={() => setSelectedFolderId(party.id)}
            >
              <span>{party.name}</span>
              <strong>{party.members.length}</strong>
            </button>
          ))}
          <button
            type="button"
            className={selectedFolderId === UNASSIGNED_FOLDER_ID ? "is-active" : ""}
            aria-pressed={selectedFolderId === UNASSIGNED_FOLDER_ID}
            onClick={() => setSelectedFolderId(UNASSIGNED_FOLDER_ID)}
          >
            <span>Unassigned</span>
            <strong>{unassignedCharacters.length}</strong>
          </button>
        </div>
      </nav>

      <section className="xp-party-folder-detail" aria-live="polite">
        {selectedParty ? (
          <PartyEditor
            party={selectedParty}
            characters={characters}
            unavailableIds={assignedIds}
            client={client}
          />
        ) : (
          <>
            <header className="xp-party-folder-detail__header">
              <div>
                <h3>Unassigned Characters</h3>
                <p>Characters not currently participating in a party.</p>
              </div>
              <input
                type="search"
                aria-label="Filter unassigned characters"
                placeholder="Find character"
                value={unassignedFilter}
                onChange={(event) => setUnassignedFilter(event.target.value)}
              />
            </header>
            {filteredUnassignedCharacters.length === 0 ? (
              <EmptyState
                message={
                  unassignedCharacters.length === 0
                    ? "Every spawned character is assigned to a party."
                    : "No unassigned characters match this search."
                }
              />
            ) : (
              <ul className="xp-character-roster">
                {filteredUnassignedCharacters.map((character) => (
                  <li key={character.instance_id}>
                    <strong>{character.name}</strong>
                    <small>{character.instance_id}</small>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
