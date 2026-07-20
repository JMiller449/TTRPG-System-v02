import { useEffect, useState } from "react";

export function SheetLevelControl({
  level,
  canEdit,
  onSave
}: {
  level: number | null;
  canEdit: boolean;
  onSave: (level: number) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(level === null ? "" : String(level));

  useEffect(() => {
    setDraft(level === null ? "" : String(level));
  }, [level]);

  const parsedDraft = Number(draft);
  const canSave =
    canEdit && Number.isInteger(parsedDraft) && parsedDraft >= 1 && parsedDraft !== level;

  return (
    <section className="sheet-level" aria-label="Character level">
      <span className="sheet-level__label">Level</span>
      {canEdit ? (
        <div className="sheet-level__editor">
          <input
            aria-label="Character level value"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="button"
            className="button button--compact"
            disabled={!canSave}
            onClick={() => onSave(parsedDraft)}
          >
            Save
          </button>
        </div>
      ) : (
        <strong className="sheet-level__value">{level ?? "Unavailable"}</strong>
      )}
    </section>
  );
}
