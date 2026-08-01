import type { ReactNode } from "react";

export function Field({
  label,
  children,
  required = false,
  invalid = false
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  invalid?: boolean;
}): JSX.Element {
  return (
    <label className={`field${invalid ? " field--invalid" : ""}`}>
      <span className="field__label">
        {label}
        {required ? (
          <>
            <span className="field__required-marker" aria-hidden="true">
              *
            </span>
            <span className="r6-sr-only"> (required)</span>
          </>
        ) : null}
      </span>
      {children}
    </label>
  );
}
