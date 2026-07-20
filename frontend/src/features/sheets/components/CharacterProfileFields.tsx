import type { CharacterProfile } from "@/domain/models";
import { Field } from "@/shared/ui/Field";

const IDENTITY_FIELDS: ReadonlyArray<{
  key: keyof CharacterProfile;
  label: string;
  placeholder: string;
}> = [
  { key: "species", label: "Species", placeholder: "e.g. Human, Elf, Goblin" },
  { key: "background", label: "Background", placeholder: "e.g. Scholar" },
  { key: "alignment", label: "Alignment", placeholder: "Optional" },
  { key: "pronouns", label: "Pronouns", placeholder: "e.g. they/them" },
  { key: "age", label: "Age", placeholder: "e.g. 32" },
  { key: "height", label: "Height", placeholder: "e.g. 6 ft 2 in" },
  { key: "weight", label: "Weight", placeholder: "e.g. 180 lb" },
  { key: "eyes", label: "Eyes", placeholder: "e.g. Amber" },
  { key: "skin", label: "Skin", placeholder: "e.g. Bronze" },
  { key: "hair", label: "Hair", placeholder: "e.g. Black, braided" }
];

const STORY_FIELDS: ReadonlyArray<{
  key: keyof CharacterProfile;
  label: string;
  placeholder: string;
  rows: number;
}> = [
  {
    key: "appearance",
    label: "Appearance",
    placeholder: "Distinguishing features, clothing, posture, or mannerisms...",
    rows: 3
  },
  {
    key: "personality_traits",
    label: "Personality Traits",
    placeholder: "Habits, temperament, and defining traits...",
    rows: 3
  },
  { key: "ideals", label: "Ideals", placeholder: "Beliefs and principles...", rows: 3 },
  {
    key: "bonds",
    label: "Bonds",
    placeholder: "People, places, or causes that matter...",
    rows: 3
  },
  { key: "flaws", label: "Flaws", placeholder: "Weaknesses, fears, or complications...", rows: 3 },
  {
    key: "allies_and_organizations",
    label: "Allies & Organizations",
    placeholder: "Important contacts, factions, and affiliations...",
    rows: 4
  },
  {
    key: "backstory",
    label: "Backstory",
    placeholder: "History, formative events, goals, and unresolved threads...",
    rows: 10
  }
];

export function CharacterProfileFields({
  profile,
  onChange,
  disabled = false
}: {
  profile: CharacterProfile;
  onChange: (profile: CharacterProfile) => void;
  disabled?: boolean;
}): JSX.Element {
  const updateField = (field: keyof CharacterProfile, value: string): void => {
    onChange({ ...profile, [field]: value });
  };

  return (
    <div className="character-profile-fields stack">
      <div className="character-profile-fields__identity">
        {IDENTITY_FIELDS.map((field) => (
          <Field key={field.key} label={field.label}>
            <input
              value={profile[field.key]}
              onChange={(event) => updateField(field.key, event.target.value)}
              placeholder={field.placeholder}
              disabled={disabled}
            />
          </Field>
        ))}
      </div>
      <div className="character-profile-fields__story">
        {STORY_FIELDS.map((field) => (
          <Field key={field.key} label={field.label}>
            <textarea
              value={profile[field.key]}
              onChange={(event) => updateField(field.key, event.target.value)}
              placeholder={field.placeholder}
              rows={field.rows}
              disabled={disabled}
            />
          </Field>
        ))}
      </div>
    </div>
  );
}
