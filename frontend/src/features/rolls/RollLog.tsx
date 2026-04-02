import { EmptyState } from "@/shared/ui/EmptyState";
import { Panel } from "@/shared/ui/Panel";

export function RollLog(): JSX.Element {
  return (
    <Panel title="Play Log">
      <div className="list">
        <EmptyState message="Roll history now lives in Roll20 chat." />
      </div>
    </Panel>
  );
}
