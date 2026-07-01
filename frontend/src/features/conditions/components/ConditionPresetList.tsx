import type { ConditionPreset } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";

export function ConditionPresetList({
  conditions,
  onEdit,
  onDelete
}: {
  conditions: ConditionPreset[];
  onEdit: (condition: ConditionPreset) => void;
  onDelete: (conditionId: string) => void;
}): JSX.Element {
  return (
    <div className="list">
      {conditions.length === 0 ? <EmptyState message="No conditions created yet." /> : null}
      {conditions.map((condition) => {
        const effects = condition.augmentation_templates ?? [];
        return (
          <article className="list-item list-item--block" key={condition.id}>
            <div className="list-item__top">
              <strong>{condition.name}</strong>
              <span className="muted">
                {condition.visibility === "gm_only" ? "GM only" : "public"}
              </span>
            </div>
            <div className="muted">{condition.description || "(no description)"}</div>
            <div className="muted">Effects: {effects.length}</div>
            {effects.length > 0 ? (
              <div className="muted">{effects.map((effect) => effect.name).join(", ")}</div>
            ) : null}
            <div className="inline-actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => onEdit(condition)}
              >
                Edit
              </button>
              <button
                type="button"
                className="button button--danger"
                onClick={() => onDelete(condition.id)}
              >
                Delete
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
