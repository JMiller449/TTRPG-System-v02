import { useMemo } from "react";
import { useAppStore } from "@/app/state/store";
import type { SheetInstance } from "@/domain/models";
import { buildSetActiveSheetIntent } from "@/features/sheets/intentBuilders";
import { Panel } from "@/shared/ui/Panel";
import { EmptyState } from "@/shared/ui/EmptyState";
import type { GameClient } from "@/hooks/useGameClient";

export function SheetTabs({ client }: { client: GameClient }): JSX.Element {
  const {
    state: { instances, instanceOrder, activeSheetId }
  } = useAppStore();

  const items = useMemo(
    () =>
      instanceOrder
        .map((id) => instances[id])
        .filter((sheet): sheet is SheetInstance => Boolean(sheet)),
    [instanceOrder, instances]
  );

  return (
    <Panel title="Active Sheets (Quick Switch)">
      <div className="tab-row">
        {items.length === 0 ? <EmptyState message="No active sheet instances." /> : null}
        {items.map((sheet) => (
          <button
            key={sheet.id}
            className={`tab ${sheet.id === activeSheetId ? "tab--active" : ""}`}
            onClick={() => client.sendIntent(buildSetActiveSheetIntent(sheet.id))}
          >
            {sheet.name}
          </button>
        ))}
      </div>
    </Panel>
  );
}
