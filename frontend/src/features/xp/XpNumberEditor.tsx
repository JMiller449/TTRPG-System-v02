import { useEffect, useState } from "react";
import { Field } from "@/shared/ui/Field";

export function XpNumberEditor({
  label,
  value,
  onSave
}: {
  label: string;
  value: number;
  onSave: (value: number) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const parsed = /^\d+$/.test(draft.trim()) ? Number(draft) : null;

  return (
    <div className="xp-number-editor">
      <Field label={label}>
        <input
          type="number"
          min={0}
          step={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </Field>
      <button
        className="button button--secondary"
        type="button"
        disabled={parsed === null || parsed === value}
        onClick={() => {
          if (parsed !== null) {
            onSave(parsed);
          }
        }}
      >
        Save
      </button>
    </div>
  );
}
