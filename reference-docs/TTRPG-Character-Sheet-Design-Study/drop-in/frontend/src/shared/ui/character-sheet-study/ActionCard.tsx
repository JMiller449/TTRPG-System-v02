import type { ReactElement } from "react";
import { StudyIcon } from "./StudyIcon";
import type { ActionViewModel } from "./types";

export function ActionCard({ action }: { action: ActionViewModel }): ReactElement {
  const unavailable = Boolean(action.disabledReason) || !action.onPerform;

  return (
    <article className={`cs-action-card ${unavailable ? "cs-action-card--disabled" : ""}`}>
      <header className="cs-action-card__header">
        <div>
          <p className="cs-action-card__category">{action.category}</p>
          <h3>{action.name}</h3>
        </div>
        {action.onToggleFavorite ? (
          <button
            type="button"
            className={`cs-favorite ${action.isFavorite ? "cs-favorite--active" : ""}`}
            aria-pressed={Boolean(action.isFavorite)}
            aria-label={`${action.isFavorite ? "Remove" : "Add"} ${action.name} ${action.isFavorite ? "from" : "to"} favorites`}
            onClick={action.onToggleFavorite}
          >
            <StudyIcon name="star" />
          </button>
        ) : null}
      </header>

      {action.summary ? <p className="cs-action-card__summary">{action.summary}</p> : null}

      <div className="cs-action-card__meta">
        {action.cost ? <span><strong>Cost</strong> {action.cost}</span> : null}
        {action.tags?.map((tag) => <span key={tag} className="cs-tag">{tag}</span>)}
      </div>

      {action.disabledReason ? <p className="cs-action-card__reason">Unavailable — {action.disabledReason}</p> : null}

      <button
        type="button"
        className="cs-action-card__perform"
        onClick={() => void action.onPerform?.()}
        disabled={unavailable || action.pending}
        aria-describedby={action.disabledReason ? `cs-action-reason-${action.id}` : undefined}
      >
        <StudyIcon name="dice" />
        <span>{action.pending ? "Sending…" : action.rollLabel ?? "Use action"}</span>
      </button>
      {action.disabledReason ? <span className="cs-sr-only" id={`cs-action-reason-${action.id}`}>{action.disabledReason}</span> : null}
    </article>
  );
}
