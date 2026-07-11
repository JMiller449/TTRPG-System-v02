import { useState } from "react";
import type { XpTrackerKillEvent } from "@/generated/backendProtocol";
import type { GameClient } from "@/hooks/useGameClient";
import { buildUpdateKillRequest } from "@/infrastructure/ws/requestBuilders";
import { Field } from "@/shared/ui/Field";

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function KillEditor({
  kill,
  characters,
  client,
  onClose
}: {
  kill: XpTrackerKillEvent;
  characters: { instance_id: string; name: string }[];
  client: GameClient;
  onClose: () => void;
}): JSX.Element {
  const [name, setName] = useState(kill.monster_name);
  const [baseXp, setBaseXp] = useState(String(kill.base_xp));
  const [occurredAt, setOccurredAt] = useState(toLocalDateTime(kill.occurred_at));
  const [notes, setNotes] = useState(kill.notes);
  const [participants, setParticipants] = useState(
    kill.participants.map((participant) => participant.instance_id)
  );
  const parsedXp = Number(baseXp);

  return (
    <div className="xp-kill-editor">
      <Field label="Monster">
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Base XP">
        <input
          type="number"
          min={0}
          step={0.01}
          value={baseXp}
          onChange={(event) => setBaseXp(event.target.value)}
        />
      </Field>
      <Field label="Occurred">
        <input
          type="datetime-local"
          value={occurredAt}
          onChange={(event) => setOccurredAt(event.target.value)}
        />
      </Field>
      <Field label="Notes">
        <input value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      <div className="xp-member-grid xp-member-grid--wide">
        {characters.map((character) => (
          <label key={character.instance_id}>
            <input
              type="checkbox"
              checked={participants.includes(character.instance_id)}
              onChange={() =>
                setParticipants((current) =>
                  current.includes(character.instance_id)
                    ? current.filter((id) => id !== character.instance_id)
                    : [...current, character.instance_id]
                )
              }
            />
            {character.name}
          </label>
        ))}
      </div>
      <div className="inline-actions">
        <button
          className="button button--primary"
          type="button"
          disabled={
            !name.trim() || !Number.isFinite(parsedXp) || parsedXp < 0 || participants.length === 0
          }
          onClick={() => {
            client.sendProtocolRequest(
              buildUpdateKillRequest({
                killId: kill.id,
                monsterSheetId: kill.monster_sheet_id,
                monsterName: name.trim(),
                baseXp: parsedXp,
                participantInstanceIds: participants,
                occurredAt: new Date(occurredAt).toISOString(),
                notes
              }),
              `Update kill: ${name}`
            );
            onClose();
          }}
        >
          Save Changes
        </button>
        <button className="button button--secondary" type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
