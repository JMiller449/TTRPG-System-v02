import { useEffect, useMemo, useState } from "react";
import { selectPlayerInstances } from "@/app/state/selectors";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildGenerateSheetAccessCodeRequest,
  buildGetSheetAccessCodesRequest
} from "@/infrastructure/ws/requestBuilders";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";

export function SheetAccessCodesPanel({ client }: { client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const { sheetAccessCodes } = state.uiState;
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const playerInstances = useMemo(() => selectPlayerInstances(state), [state]);
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const activeCodes = sheetAccessCodes.filter((entry) => entry.active);
  const selectedInstance = playerInstances.find((entry) => entry.id === selectedInstanceId);
  const selectedCode = activeCodes.find((entry) => entry.instanceId === selectedInstanceId);

  useEffect(() => {
    client.sendProtocolRequest(buildGetSheetAccessCodesRequest(), "Load player access codes");
  }, [client]);

  useEffect(() => {
    setSelectedInstanceId((current) => {
      if (current && playerInstances.some((entry) => entry.id === current)) {
        return current;
      }
      return playerInstances[0]?.id ?? "";
    });
  }, [playerInstances]);

  const copyCode = async (code: string): Promise<void> => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
  };

  const provisionSelectedInstance = (): void => {
    if (!selectedInstance?.parentSheet) {
      return;
    }
    client.sendProtocolRequest(
      buildGenerateSheetAccessCodeRequest({
        sheetId: selectedInstance.parentSheet.id,
        instanceId: selectedInstance.id
      }),
      `${selectedCode ? "Replace" : "Generate"} access code: ${selectedInstance.name}`
    );
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
      <div className="stack">
        <div className="inline-group">
          <Field label="Player Instance">
            <select
              value={selectedInstanceId}
              onChange={(event) => setSelectedInstanceId(event.target.value)}
              disabled={playerInstances.length === 0}
            >
              {playerInstances.length === 0 ? <option value="">No player instances</option> : null}
              {playerInstances.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instance.name} ({instance.id})
                </option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            className="button"
            onClick={provisionSelectedInstance}
            disabled={!selectedInstance?.parentSheet}
          >
            {selectedCode ? "Replace Code" : "Generate Code"}
          </button>
        </div>
        {selectedInstance ? (
          <p className="muted">
            {selectedCode
              ? `Current code for ${selectedInstance.name}: ${selectedCode.code}`
              : `${selectedInstance.name} does not have an active access code.`}
          </p>
        ) : null}
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
      </div>
    </Panel>
  );
}
