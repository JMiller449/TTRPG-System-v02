import { useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import { buildGetSheetAccessCodesRequest } from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Panel } from "@/shared/ui/Panel";

export function SheetAccessCodesPanel({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      uiState: { sheetAccessCodes }
    }
  } = useAppStore();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const activeCodes = sheetAccessCodes.filter((entry) => entry.active);

  const copyCode = async (code: string): Promise<void> => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
  };

  return (
    <Panel
      title="Player Access Codes"
      actions={
        <button
          type="button"
          className="button button--secondary"
          onClick={() =>
            client.sendProtocolRequest(
              buildGetSheetAccessCodesRequest(),
              "Refresh player access codes"
            )
          }
        >
          Refresh
        </button>
      }
    >
      <div className="list">
        {activeCodes.length === 0 ? (
          <EmptyState message="No active player access codes loaded." />
        ) : null}
        {activeCodes.map((entry) => (
          <article className="list-item" key={entry.code}>
            <div>
              <strong>{entry.code}</strong>
              <div className="muted">
                Instance: {entry.instanceId ?? "unassigned"} · Template: {entry.sheetId}
              </div>
            </div>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void copyCode(entry.code)}
            >
              {copiedCode === entry.code ? "Copied" : "Copy"}
            </button>
          </article>
        ))}
      </div>
    </Panel>
  );
}
