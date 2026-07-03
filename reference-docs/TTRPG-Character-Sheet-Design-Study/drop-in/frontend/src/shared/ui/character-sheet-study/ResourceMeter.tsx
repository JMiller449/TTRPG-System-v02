import type { CSSProperties, ReactElement } from "react";
import { StudyIcon, type StudyIconName } from "./StudyIcon";
import type { ResourceViewModel } from "./types";

const ICONS: Record<NonNullable<ResourceViewModel["tone"]>, StudyIconName> = {
  health: "heart",
  mana: "mana",
  action: "action",
  reaction: "reaction",
  neutral: "status"
};

export function ResourceMeter({ resource }: { resource: ResourceViewModel }): ReactElement {
  const tone = resource.tone ?? "neutral";
  const hasMax = typeof resource.max === "number" && Number.isFinite(resource.max);
  const safeMax = hasMax && resource.max! > 0 ? resource.max! : 1;
  const percent = hasMax ? Math.max(0, Math.min(100, (resource.value / safeMax) * 100)) : 100;
  const pending = resource.status === "pending";
  const valueText = hasMax ? `${resource.value} / ${resource.max}` : String(resource.value);
  const accessibleValue = `${resource.label}: ${valueText}${resource.unit ? ` ${resource.unit}` : ""}`;

  return (
    <section className={`cs-resource cs-resource--${tone} ${pending ? "cs-resource--pending" : ""}`} aria-label={accessibleValue}>
      <div className="cs-resource__top">
        <span className="cs-resource__label">
          <StudyIcon name={ICONS[tone]} size={16} />
          {resource.label}
        </span>
        <output className="cs-resource__value" aria-live="off">
          <strong>{resource.value}</strong>
          {hasMax ? <span> / {resource.max}</span> : null}
          {resource.unit ? <small>{resource.unit}</small> : null}
        </output>
      </div>

      {hasMax ? (
        <div
          className="cs-resource__track"
          role="progressbar"
          aria-label={resource.label}
          aria-valuemin={0}
          aria-valuemax={resource.max}
          aria-valuenow={resource.value}
        >
          <span style={{ "--cs-meter-percent": `${percent}%` } as CSSProperties} />
        </div>
      ) : null}

      {resource.onDecrease || resource.onIncrease ? (
        <div className="cs-resource__controls">
          <button
            type="button"
            className="cs-icon-button"
            onClick={() => void resource.onDecrease?.()}
            disabled={pending || !resource.onDecrease}
            aria-label={`Reduce ${resource.label}`}
          >
            <StudyIcon name="minus" />
          </button>
          <span className="cs-resource__state" aria-hidden="true">{pending ? "Saving…" : "Adjust"}</span>
          <button
            type="button"
            className="cs-icon-button"
            onClick={() => void resource.onIncrease?.()}
            disabled={pending || !resource.onIncrease}
            aria-label={`Increase ${resource.label}`}
          >
            <StudyIcon name="plus" />
          </button>
        </div>
      ) : null}

      {resource.errorMessage ? <p className="cs-inline-error" role="alert">{resource.errorMessage}</p> : null}
    </section>
  );
}
