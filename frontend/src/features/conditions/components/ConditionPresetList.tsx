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
      {conditions.map((condition) => (
        <article className="list-item list-item--block" key={condition.id}>
          <div className="list-item__top">
            <strong>{condition.name}</strong>
            <span className="muted">{condition.visibility === "gm_only" ? "GM only" : "public"}</span>
          </div>
          <div className="muted">{condition.description || "(no description)"}</div>
          <div className="muted">
            Augmentations: {condition.augmentation_templates?.length ?? 0}
          </div>
          <div className="inline-actions">
            <button className="button button--secondary" onClick={() => onEdit(condition)}>
              Edit
            </button>
            <button className="button button--secondary" onClick={() => onDelete(condition.id)}>
              Delete
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
