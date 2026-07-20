import { useEffect, useMemo, useState } from "react";
import type { CharacterProfile } from "@/domain/models";
import { resolveCharacterProfile } from "@/features/sheets/characterProfile";
import { CharacterProfileFields } from "@/features/sheets/components/CharacterProfileFields";

export function SheetProfileSection({
  sheetId,
  profile,
  onSave
}: {
  sheetId: string;
  profile: Partial<CharacterProfile> | null | undefined;
  onSave: (profile: CharacterProfile) => void;
}): JSX.Element {
  const authoritativeKey = JSON.stringify(resolveCharacterProfile(profile));
  const authoritativeProfile = useMemo(
    () => JSON.parse(authoritativeKey) as CharacterProfile,
    [authoritativeKey]
  );
  const [draft, setDraft] = useState<CharacterProfile>(authoritativeProfile);

  useEffect(() => {
    setDraft(authoritativeProfile);
  }, [authoritativeProfile, sheetId]);

  const isDirty = JSON.stringify(draft) !== authoritativeKey;

  return (
    <section className="character-sheet__section sheet-profile-section stack">
      <header className="sheet-profile-section__header">
        <div>
          <h4>Character Profile</h4>
          <p className="muted">
            Descriptive details only. Height, weight, species, and story fields do not change
            character mechanics.
          </p>
        </div>
        <span
          className={`sheet-profile-section__status${
            isDirty ? " sheet-profile-section__status--pending" : ""
          }`}
          role="status"
          aria-live="polite"
        >
          {isDirty ? "Unsaved changes" : "All changes saved"}
        </span>
      </header>
      <CharacterProfileFields profile={draft} onChange={setDraft} />
      <footer className="sheet-profile-section__actions">
        <button className="button" type="button" onClick={() => onSave(draft)} disabled={!isDirty}>
          Save Profile
        </button>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => setDraft(authoritativeProfile)}
          disabled={!isDirty}
        >
          Reset
        </button>
      </footer>
    </section>
  );
}
