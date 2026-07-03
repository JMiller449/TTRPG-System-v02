import { useState, type ReactElement } from "react";
import type { R6Action } from "./types";

export type R6RollMode = "normal" | "advantage" | "disadvantage";

export interface ActionCardProps {
  action: R6Action;
  onRoll?: (mode: R6RollMode) => void;
  defaultRollMode?: R6RollMode;
}

export function ActionCard({ action, onRoll, defaultRollMode = "normal" }: ActionCardProps): ReactElement {
  const [rollMode, setRollMode] = useState<R6RollMode>(defaultRollMode);
  const disabled = Boolean(action.disabledReason) || !onRoll;

  return (
    <article className={`r6-action-card${disabled ? " r6-action-card--disabled" : ""}`}>
      <div className="r6-action-card__main">
        <div>
          <p className="r6-kicker">{action.category}{action.governingStat ? ` · ${action.governingStat}` : ""}</p>
          <h3>{action.name}</h3>
        </div>
        {action.cost ? <span className="r6-action-card__cost">{action.cost}</span> : null}
      </div>
      {action.formula ? <code className="r6-action-card__formula">{action.formula}</code> : null}
      {action.tags?.length ? (
        <div className="r6-chip-row">
          {action.tags.map((tag) => <span className="r6-chip r6-chip--neutral" key={tag}>{tag}</span>)}
        </div>
      ) : null}
      {action.description ? (
        <details className="r6-disclosure">
          <summary>Details</summary>
          <p>{action.description}</p>
        </details>
      ) : null}
      <div className="r6-action-card__footer">
        <label className="r6-inline-select">
          <span className="r6-sr-only">Roll mode for {action.name}</span>
          <select value={rollMode} onChange={(event) => setRollMode(event.target.value as R6RollMode)} disabled={disabled}>
            <option value="normal">Normal</option>
            <option value="advantage">Advantage</option>
            <option value="disadvantage">Disadvantage</option>
          </select>
        </label>
        <button
          type="button"
          className="r6-button r6-button--primary"
          disabled={disabled}
          title={action.disabledReason}
          onClick={() => onRoll?.(rollMode)}
        >
          Roll Action
        </button>
      </div>
      {action.disabledReason ? <p className="r6-action-card__disabled-reason">{action.disabledReason}</p> : null}
    </article>
  );
}
