import type { ActiveCondition } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";

export function SheetConditionsSection({
  conditions,
  canRemove,
  onRemove
}: {
  conditions: ActiveCondition[];
  canRemove: boolean;
  onRemove: (applicationId: string) => void;
}): JSX.Element {
  return (
    <section className="character-sheet__section">
      <h4>Active Conditions</h4>
      <div className="list">
        {conditions.length === 0 ? <EmptyState message="No active conditions." /> : null}
        {conditions.map((condition) => (
          <article className="list-item list-item--block" key={condition.application_id}>
            <div className="list-item__top">
              <strong>{condition.condition_name}</strong>
              <span className="muted">
                {condition.visibility === "gm_only" ? "GM only" : "Public"}
              </span>
            </div>
            {condition.description ? <div className="muted">{condition.description}</div> : null}
            <div className="muted">Effects: {condition.augmentation_ids.length}</div>
            {canRemove ? (
              <div className="inline-actions">
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => onRemove(condition.application_id)}
                >
                  Remove
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
