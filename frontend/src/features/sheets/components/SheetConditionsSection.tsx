import type { ActiveCondition, Augmentation, ConditionSource } from "@/domain/models";
import { formatAugmentationLifecycle } from "@/features/augmentations/augmentationEditorValues";
import { EmptyState } from "@/shared/ui/EmptyState";

function sourceLabel(source: ConditionSource | undefined): string {
  if (!source) {
    return "Unknown";
  }
  if (source.label) {
    return source.label;
  }
  switch (source.type) {
    case "action":
      return source.id ? `Action: ${source.id}` : "Action";
    case "item":
      return source.id ? `Item: ${source.id}` : "Item";
    case "condition":
      return "Condition";
    case "manual":
      return "GM (manual)";
    default:
      return "Other";
  }
}

function formatAppliedAt(appliedAt: string | null | undefined): string | null {
  if (!appliedAt) {
    return null;
  }
  const parsed = new Date(appliedAt);
  return Number.isNaN(parsed.getTime()) ? appliedAt : parsed.toLocaleString();
}

function conditionLifecycleSummary(
  condition: ActiveCondition,
  augmentations: Record<string, Augmentation>
): string | null {
  const first = condition.augmentation_ids
    .map((id) => augmentations[id])
    .find((augmentation): augmentation is Augmentation => Boolean(augmentation));
  return first ? formatAugmentationLifecycle(first.lifecycle) : null;
}

export function SheetConditionsSection({
  conditions,
  augmentations,
  mode,
  canRemove,
  onRemove
}: {
  conditions: ActiveCondition[];
  augmentations: Record<string, Augmentation>;
  mode: "player" | "gm";
  canRemove: boolean;
  onRemove: (applicationId: string) => void;
}): JSX.Element {
  return (
    <section className="character-sheet__section">
      <h4>Active Conditions</h4>
      <div className="list">
        {conditions.length === 0 ? <EmptyState message="No active conditions." /> : null}
        {conditions.map((condition) => {
          const lifecycleSummary = conditionLifecycleSummary(condition, augmentations);
          const appliedAt = formatAppliedAt(condition.applied_at);
          return (
            <article className="list-item list-item--block" key={condition.application_id}>
              <div className="list-item__top">
                <strong>{condition.condition_name}</strong>
                <span className="muted">
                  {condition.visibility === "gm_only" ? "GM only" : "Public"}
                </span>
              </div>
              {condition.description ? (
                <div className="muted">{condition.description}</div>
              ) : null}
              <div className="muted">Effects: {condition.augmentation_ids.length}</div>
              {lifecycleSummary ? <div className="muted">Duration: {lifecycleSummary}</div> : null}
              {mode === "gm" ? (
                <div className="muted">
                  Source: {sourceLabel(condition.source)}
                  {appliedAt ? ` · Applied ${appliedAt}` : ""}
                  {condition.applied_by_role ? ` by ${condition.applied_by_role}` : ""}
                </div>
              ) : null}
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
          );
        })}
      </div>
    </section>
  );
}
