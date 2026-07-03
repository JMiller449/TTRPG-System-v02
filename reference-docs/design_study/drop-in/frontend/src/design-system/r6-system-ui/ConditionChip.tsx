import type { ReactElement } from "react";
import type { R6Tone } from "./types";

export interface ConditionChipProps {
  label: string;
  meta?: string;
  tone?: R6Tone;
  onRemove?: () => void;
}

export function ConditionChip({ label, meta, tone = "warning", onRemove }: ConditionChipProps): ReactElement {
  return (
    <span className={`r6-condition r6-condition--${tone}`}>
      <span className="r6-condition__marker" aria-hidden="true" />
      <span><strong>{label}</strong>{meta ? <small>{meta}</small> : null}</span>
      {onRemove ? <button type="button" onClick={onRemove} aria-label={`Remove ${label}`}>×</button> : null}
    </span>
  );
}
