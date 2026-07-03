import type { ReactElement } from "react";
import type { R6Stat } from "./types";

export interface StatGridProps {
  stats: R6Stat[];
  onRoll?: (stat: R6Stat) => void;
  label?: string;
}

function formatModifier(modifier: R6Stat["modifier"]): string | null {
  if (modifier === undefined || modifier === null || modifier === "") return null;
  if (typeof modifier === "number") return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  return String(modifier);
}

export function StatGrid({ stats, onRoll, label = "Statistics" }: StatGridProps): ReactElement {
  return (
    <div className="r6-stat-grid" aria-label={label}>
      {stats.map((stat) => {
        const modifier = formatModifier(stat.modifier);
        const content = (
          <>
            <span className="r6-stat-card__glyph" aria-hidden="true"><span>{stat.glyph ?? stat.shortLabel}</span></span>
            <span className="r6-stat-card__copy">
              <span className="r6-stat-card__short">{stat.shortLabel}</span>
              <span className="r6-stat-card__label">{stat.label}</span>
            </span>
            <span className="r6-stat-card__numbers">
              <strong>{stat.value}</strong>
              {modifier ? <span>{modifier}</span> : null}
            </span>
            {onRoll ? <span className="r6-stat-card__roll-hint" aria-hidden="true">Roll</span> : null}
          </>
        );

        return onRoll ? (
          <button
            type="button"
            className="r6-stat-card r6-stat-card--interactive"
            key={stat.key}
            title={stat.description}
            onClick={() => onRoll(stat)}
            aria-label={`Roll ${stat.label}; current value ${stat.value}`}
          >
            {content}
          </button>
        ) : (
          <div className="r6-stat-card" key={stat.key} title={stat.description}>{content}</div>
        );
      })}
    </div>
  );
}
