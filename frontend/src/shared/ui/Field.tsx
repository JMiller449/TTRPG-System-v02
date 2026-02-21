import type { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}
