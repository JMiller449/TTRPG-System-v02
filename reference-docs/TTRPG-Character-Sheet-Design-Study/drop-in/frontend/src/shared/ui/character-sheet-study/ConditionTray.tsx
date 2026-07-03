import type { ReactElement } from "react";
import { StudyIcon } from "./StudyIcon";
import type { ConditionViewModel } from "./types";

export function ConditionTray({ conditions }: { conditions: readonly ConditionViewModel[] }): ReactElement {
  return (
    <section className="cs-section" aria-labelledby="cs-condition-title">
      <div className="cs-section__heading">
        <div>
          <p className="cs-eyebrow">Current state</p>
          <h2 id="cs-condition-title">Conditions</h2>
        </div>
        <span className="cs-count">{conditions.length} active</span>
      </div>

      {conditions.length ? (
        <div className="cs-condition-grid">
          {conditions.map((condition) => (
            <article key={condition.id} className={`cs-condition cs-condition--${condition.severity ?? "info"}`}>
              <div className="cs-condition__marker" aria-hidden="true" />
              <div className="cs-condition__body">
                <div className="cs-condition__title-row">
                  <h3>{condition.name}</h3>
                  {condition.duration ? <span>{condition.duration}</span> : null}
                </div>
                {condition.summary ? <p>{condition.summary}</p> : null}
                {condition.source ? <small>Source: {condition.source}</small> : null}
              </div>
              {condition.removable && condition.onRemove ? (
                <button
                  type="button"
                  className="cs-icon-button cs-icon-button--danger"
                  onClick={() => void condition.onRemove?.()}
                  disabled={condition.pending}
                  aria-label={`Remove ${condition.name}`}
                >
                  <StudyIcon name="close" />
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : <p className="cs-empty">No active conditions.</p>}
    </section>
  );
}
