import { useState } from "react";
import type { AssignedSheetAction } from "@/app/state/selectors";
import { RollModeControl } from "@/features/rolls/RollModeControl";
import type { ActionRollMode } from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";

export function SheetActionsSection({
  assignedActions,
  onPerformAction
}: {
  assignedActions: AssignedSheetAction[];
  onPerformAction: (action: AssignedSheetAction, rollMode: ActionRollMode) => void;
}): JSX.Element {
  const [rollMode, setRollMode] = useState<ActionRollMode>("normal");

  return (
    <section className="sheet-actions-section">
      <RollModeControl value={rollMode} onChange={setRollMode} />
      <div className="list">
        {assignedActions.length === 0 ? <EmptyState message="No actions assigned to this sheet." /> : null}
        {assignedActions.map((entry) => (
          <article className="list-item list-item--block" key={entry.relationshipId}>
            <div className="list-item__top">
              <strong>{entry.action.name}</strong>
              <span className="muted">{entry.relationshipId}</span>
            </div>
            {entry.action.notes ? <div className="muted">{entry.action.notes}</div> : null}
            <div className="muted">Steps: {entry.action.steps?.length ?? 0}</div>
            <div className="inline-actions">
              <button className="button" onClick={() => onPerformAction(entry, rollMode)}>
                Perform Action
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
