import type { ReactElement } from "react";
import type { R6Tone } from "./types";

export interface ResourceMeterProps {
  label: string;
  current: number;
  max: number;
  tone?: R6Tone;
  glyph?: string;
  compact?: boolean;
  onAdjust?: (delta: number) => void;
  step?: number;
}

export function ResourceMeter({
  label,
  current,
  max,
  tone = "default",
  glyph,
  compact = false,
  onAdjust,
  step = 1
}: ResourceMeterProps): ReactElement {
  const safeMax = Math.max(0, max);
  const percent = safeMax === 0 ? 0 : Math.min(100, Math.max(0, (current / safeMax) * 100));
  const displayCurrent = new Intl.NumberFormat().format(current);
  const displayMax = new Intl.NumberFormat().format(max);

  return (
    <div className={`r6-resource r6-resource--${tone}${compact ? " r6-resource--compact" : ""}`}>
      <div className="r6-resource__top">
        <span className="r6-resource__label">
          {glyph ? <span className="r6-resource__glyph" aria-hidden="true">{glyph}</span> : null}
          {label}
        </span>
        <output className="r6-resource__value" aria-label={`${label}: ${displayCurrent} of ${displayMax}`}>
          <strong>{displayCurrent}</strong><span> / {displayMax}</span>
        </output>
      </div>
      <div
        className="r6-resource__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={current}
      >
        <span className="r6-resource__fill" style={{ width: `${percent}%` }} />
      </div>
      {onAdjust ? (
        <div className="r6-resource__controls" aria-label={`Adjust ${label}`}>
          <button type="button" onClick={() => onAdjust(-step)} aria-label={`Decrease ${label} by ${step}`}>−</button>
          <button type="button" onClick={() => onAdjust(step)} aria-label={`Increase ${label} by ${step}`}>+</button>
        </div>
      ) : null}
    </div>
  );
}
