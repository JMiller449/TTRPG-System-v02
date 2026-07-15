import { useEffect, useState } from "react";
import { Field } from "@/shared/ui/Field";

export function SheetNotesSection({
  sheetId,
  note,
  onSave
}: {
  sheetId: string;
  note: string;
  onSave: (note: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(note);
  const [lastSubmittedNote, setLastSubmittedNote] = useState<string | null>(null);

  useEffect(() => {
    setDraft(note);
    setLastSubmittedNote(null);
  }, [sheetId, note]);

  useEffect(() => {
    if (note === lastSubmittedNote || draft === note) {
      setDraft(note);
      setLastSubmittedNote(null);
    }
  }, [draft, lastSubmittedNote, note]);

  const isDirty = draft !== note;

  return (
    <section className="character-sheet__section sheet-notes-section">
      <header className="sheet-notes-section__header">
        <div>
          <h4>Instance Note</h4>
          <p className="muted">Saved with this character sheet.</p>
        </div>
        <span
          className={`sheet-notes-section__status${
            isDirty ? " sheet-notes-section__status--pending" : ""
          }`}
          role="status"
          aria-live="polite"
        >
          {isDirty ? "Unsaved changes" : "All changes saved"}
        </span>
      </header>
      <Field label="Notes">
        <textarea
          className="sheet-notes-section__editor"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={12}
          placeholder="Record session details, character reminders, or plans..."
        />
      </Field>
      <footer className="sheet-notes-section__actions">
        <button
          className="button"
          type="button"
          onClick={() => {
            setLastSubmittedNote(draft);
            onSave(draft);
          }}
          disabled={!isDirty}
        >
          Save Notes
        </button>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => {
            setDraft(note);
            setLastSubmittedNote(null);
          }}
          disabled={!isDirty}
        >
          Reset
        </button>
      </footer>
    </section>
  );
}
