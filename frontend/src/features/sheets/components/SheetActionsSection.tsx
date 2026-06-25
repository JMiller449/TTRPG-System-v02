import type { AssignedSheetAction } from "@/app/state/selectors";
import { EmptyState } from "@/shared/ui/EmptyState";

export function SheetActionsSection({
  assignedActions,
  onPerformAction
}: {
  assignedActions: AssignedSheetAction[];
  onPerformAction: (action: AssignedSheetAction) => void;
}): JSX.Element {
  return (
    <section className="sheet-actions-section">
      <div className="list">
        {assignedActions.length === 0 ? (
          <EmptyState message="No actions assigned to this sheet." />
        ) : null}
        {assignedActions.map((entry) => (
          <article className="list-item list-item--block" key={entry.relationshipId}>
            <div className="list-item__top">
              <strong>{entry.action.name}</strong>
              <span className="muted">{entry.relationshipId}</span>
            </div>
            {entry.action.notes ? <div className="muted">{entry.action.notes}</div> : null}
            <div className="muted">Steps: {entry.action.steps?.length ?? 0}</div>
            <div className="inline-actions">
              <button
                type="button"
                className="button"
                onClick={() => onPerformAction(entry)}
                aria-label={`Perform ${entry.action.name}`}
              >
                Perform Action
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
