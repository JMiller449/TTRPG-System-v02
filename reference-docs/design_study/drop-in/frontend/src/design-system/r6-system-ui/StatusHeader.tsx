import type { ReactElement, ReactNode } from "react";

export interface StatusHeaderProps {
  name: string;
  title?: string;
  rank?: string;
  level: number | string;
  subtitle?: string;
  portraitUrl?: string;
  badges?: string[];
  trailing?: ReactNode;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function StatusHeader({
  name,
  title,
  rank,
  level,
  subtitle,
  portraitUrl,
  badges = [],
  trailing
}: StatusHeaderProps): ReactElement {
  return (
    <header className="r6-status-header">
      <div className="r6-status-header__portrait" aria-hidden={portraitUrl ? undefined : true}>
        {portraitUrl ? <img src={portraitUrl} alt="" /> : <span>{initials(name)}</span>}
      </div>
      <div className="r6-status-header__identity">
        <p className="r6-kicker">Status Interface</p>
        <h1>{name}</h1>
        <div className="r6-status-header__meta">
          {title ? <span className="r6-status-header__title">{title}</span> : null}
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        {badges.length ? (
          <div className="r6-chip-row" aria-label="Character tags">
            {badges.map((badge) => (
              <span className="r6-chip r6-chip--neutral" key={badge}>{badge}</span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="r6-status-header__level" aria-label={`Level ${level}${rank ? `, rank ${rank}` : ""}`}>
        <span className="r6-status-header__level-value">{level}</span>
        <span className="r6-status-header__level-label">Level</span>
        {rank ? <span className="r6-status-header__rank">Rank {rank}</span> : null}
      </div>
      {trailing ? <div className="r6-status-header__trailing">{trailing}</div> : null}
    </header>
  );
}
