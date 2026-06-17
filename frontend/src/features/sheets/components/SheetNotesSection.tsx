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
      <Field label="Instance Notes">
        <textarea
          value={note}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          placeholder="Write quick notes here..."
        />
      </Field>
    </section>
  );
}
