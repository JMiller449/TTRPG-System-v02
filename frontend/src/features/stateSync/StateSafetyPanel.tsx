import type { GameClient } from "@/hooks/useGameClient";
import { buildUndoLastStateChangeSubmission } from "@/features/stateSync/stateSafety";
import { Panel } from "@/shared/ui/Panel";

export function StateSafetyPanel({ client }: { client: GameClient }): JSX.Element {
  const undoLastChange = (): void => {
    if (!window.confirm("Undo the last backend state change?")) {
      return;
    }
    const submission = buildUndoLastStateChangeSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  };

  return (
    <Panel title="State Safety">
      <button type="button" className="button button--danger" onClick={undoLastChange}>
        Undo Last Change
      </button>
    </Panel>
  );
}
