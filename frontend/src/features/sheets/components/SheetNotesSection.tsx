import { Field } from "@/shared/ui/Field";

export function SheetNotesSection({
  note,
  onChange
}: {
  note: string;
  onChange: (note: string) => void;
}): JSX.Element {
  return (
    <section className="character-sheet__section">
      <h4>Notes</h4>
      <Field label="Player Notes">
        <textarea
          value={note}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          placeholder="Write quick player notes here..."
        />
      </Field>
      <p className="muted">Quick notes are local scaffold state until backend note persistence is finalized.</p>
    </section>
  );
}
