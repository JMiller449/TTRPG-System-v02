import { Field } from "@/shared/ui/Field";

export function KillQuantityField({
  value,
  onChange,
  disabled = false
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <Field label="Quantity" required>
      <input
        type="number"
        title="Number of enemies of this type defeated in this entry"
        aria-description="Number of enemies of this type defeated in this entry"
        min="1"
        max="10000"
        step="1"
        required
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
