import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";

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
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setDraft(level === null ? "" : String(level));
    setEditing(false);
  }, [level]);

  const parsedDraft = Number(draft);
  const canSave =
    canEdit && Number.isInteger(parsedDraft) && parsedDraft >= 1 && parsedDraft !== level;
  const cancelEditing = (): void => {
    setDraft(level === null ? "" : String(level));
    setEditing(false);
  };
  const saveLevel = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSave) {
      return;
    }
    onSave(parsedDraft);
    setEditing(false);
  };
  const handleEditorKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  };

  return (
    <section className="sheet-level" aria-label="Character level">
      {canEdit && editing ? (
        <form className="sheet-level__editor" onSubmit={saveLevel}>
          <label className="sheet-level__label" htmlFor="sheet-level-value">
            Level
          </label>
          <input
            id="sheet-level-value"
            aria-label="Character level value"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleEditorKeyDown}
            autoFocus
          />
          <button type="submit" className="button button--compact" disabled={!canSave}>
            Save
          </button>
          <button
            type="button"
            className="button button--secondary button--compact"
            onClick={cancelEditing}
          >
            Cancel
          </button>
        </form>
      ) : canEdit ? (
        <button
          type="button"
          className="sheet-level__trigger"
          aria-label={`Edit character level. Current level ${level ?? "unavailable"}.`}
          title="Edit level"
          onClick={() => setEditing(true)}
        >
          <span className="sheet-level__label">Level</span>
          <strong className="sheet-level__value">{level ?? "Unavailable"}</strong>
        </button>
      ) : (
        <div className="sheet-level__display">
          <span className="sheet-level__label">Level</span>
          <strong className="sheet-level__value">{level ?? "Unavailable"}</strong>
        </div>
      )}
    </section>
  );
}
