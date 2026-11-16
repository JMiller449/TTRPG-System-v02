import { useState } from "react";
import type {
  ActiveCondition,
  Augmentation,
  ConditionPreset,
  ConditionSource
} from "@/domain/models";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";
import { formatAugmentationLifecycle } from "@/features/augmentations/augmentationEditorValues";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ModalDialog } from "@/shared/ui/ModalDialog";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";

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
  onRemove,
  conditionPresets = [],
  canAdd = false,
  onAdd = () => undefined
}: {
  conditions: ActiveCondition[];
  augmentations: Record<string, Augmentation>;
  mode: "player" | "gm";
  canRemove: boolean;
  onRemove: (applicationId: string) => void;
  conditionPresets?: ConditionPreset[];
  canAdd?: boolean;
  onAdd?: (conditionId: string) => void;
}): JSX.Element {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedConditionId, setSelectedConditionId] = useState("");
  const activeConditionIds = new Set(conditions.map((condition) => condition.condition_id));
  const closeAddDialog = (): void => {
    setAddDialogOpen(false);
    setSelectedConditionId("");
  };

  return (
    <section className="character-sheet__section">
      <div className="condition-section__heading">
        <h4>Active Conditions</h4>
        {canAdd ? (
          <button
            className="button button--secondary"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={addDialogOpen}
            onClick={() => setAddDialogOpen(true)}
          >
            Add Condition
          </button>
        ) : null}
      </div>
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
              {condition.description ? <div className="muted">{condition.description}</div> : null}
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
                    onClick={() => {
                      if (
                        !confirmDestructiveAction({
                          action: "Remove",
                          subject: condition.condition_name,
                          consequence:
                            "This removes the active condition and its condition-owned effects from the selected character."
                        })
                      ) {
                        return;
                      }
                      onRemove(condition.application_id);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {canAdd && addDialogOpen ? (
        <ModalDialog
          title="Add Condition"
          description="Apply an existing condition directly to this character as the DM."
          onClose={closeAddDialog}
        >
          <div className="stack">
            <CatalogEntityPicker
              catalog="conditions"
              label="Condition"
              placeholder="Search condition catalog"
              selectedId={selectedConditionId}
              options={conditionPresets.map((condition) => ({
                id: condition.id,
                label: condition.name,
                secondary: condition.description,
                keywords: [condition.id, condition.visibility].filter(
                  (keyword): keyword is string => Boolean(keyword)
                ),
                value: condition.id,
                disabledReason: activeConditionIds.has(condition.id) ? "Already active" : undefined
              }))}
              emptyMessage="No conditions are available."
              onSelect={setSelectedConditionId}
            />
            <div className="inline-actions">
              <button
                className="button"
                type="button"
                disabled={!selectedConditionId || activeConditionIds.has(selectedConditionId)}
                onClick={() => {
                  onAdd(selectedConditionId);
                  closeAddDialog();
                }}
              >
                Apply Condition
              </button>
              <button className="button button--secondary" type="button" onClick={closeAddDialog}>
                Cancel
              </button>
            </div>
          </div>
        </ModalDialog>
      ) : null}
    </section>
  );
}
