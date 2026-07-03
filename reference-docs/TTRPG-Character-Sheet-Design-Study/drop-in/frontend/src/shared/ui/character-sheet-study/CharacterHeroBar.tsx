import type { ReactElement } from "react";
import { ResourceMeter } from "./ResourceMeter";
import { SyncStatus } from "./SyncStatus";
import type { CharacterHeroBarProps } from "./types";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function CharacterHeroBar({
  name,
  eyebrow,
  subtitle,
  level,
  portraitUrl,
  badges = [],
  resources,
  syncStatus,
  actions
}: CharacterHeroBarProps): ReactElement {
  return (
    <header className="cs-hero">
      <div className="cs-hero__identity">
        <div className="cs-hero__portrait" aria-hidden="true">
          {portraitUrl ? <img src={portraitUrl} alt="" /> : <span>{initials(name)}</span>}
        </div>
        <div className="cs-hero__copy">
          {eyebrow ? <p className="cs-eyebrow">{eyebrow}</p> : null}
          <div className="cs-hero__name-line">
            <h1>{name}</h1>
            {typeof level === "number" ? <span className="cs-level">Level {level}</span> : null}
          </div>
          {subtitle ? <p className="cs-hero__subtitle">{subtitle}</p> : null}
          {badges.length ? (
            <ul className="cs-badge-row" aria-label="Character tags">
              {badges.map((badge) => <li key={badge}>{badge}</li>)}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="cs-hero__meta">
        {syncStatus ? <SyncStatus status={syncStatus} /> : null}
        {actions ? <div className="cs-hero__actions">{actions}</div> : null}
      </div>

      <div className="cs-hero__resources">
        {resources.map((resource) => <ResourceMeter key={resource.id} resource={resource} />)}
      </div>
    </header>
  );
}
