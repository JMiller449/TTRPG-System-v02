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
    <section className="character-sheet__section">
      <h4>Notes</h4>
      <Field label="Instance Notes">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={5}
          placeholder="Write quick notes here..."
        />
      </Field>
      <div className="status-row">
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
        <span className="muted" role="status" aria-live="polite">
          {isDirty ? "Local draft pending save." : "Synced to backend."}
        </span>
      </div>
    </section>
  );
}
