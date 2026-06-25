import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { selectActiveWeaponLabel, selectSheetInstanceView } from "@/app/state/selectors";
import type { GameClient } from "@/hooks/useGameClient";
import { buildGetRoll20BridgeStatusRequest } from "@/infrastructure/ws/requestBuilders";
import {
  buildQuickRollExecutionRequest,
  getQuickRollLabel,
  QUICK_ROLL_ACTIONS,
  resolveQuickRollAction,
  type QuickRollAction,
  type QuickRollMode,
  type QuickRollVisibility
} from "@/features/rolls/quickRolls";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";

export function RollPanel({
  client,
  mode = "player"
}: {
  client: GameClient;
  mode?: "gm" | "player";
}): JSX.Element {
  const { state } = useAppStore();
  const { activeSheetId } = state.uiState;
  const { roll20Bridge } = state.uiState;
  const { actions } = state.serverState;

  const [selectedQuickAction, setSelectedQuickAction] = useState<QuickRollAction | null>(null);
  const [rollMode, setRollMode] = useState<QuickRollMode>("normal");
  const [visibility, setVisibility] = useState<QuickRollVisibility>("public");

  const activeSheetView = useMemo(() => {
    if (!activeSheetId) {
      return null;
    }
    return selectSheetInstanceView(state, activeSheetId);
  }, [activeSheetId, state]);
  const activeSheetName = activeSheetView?.name ?? activeSheetId ?? "None";
  const activeWeapon = useMemo(() => {
    if (!activeSheetId) {
      return null;
    }
    const label = selectActiveWeaponLabel(state, activeSheetId);
    return label === "None" ? null : label;
  }, [activeSheetId, state]);
  const quickActionResolutions = useMemo(
    () =>
      Object.fromEntries(
        QUICK_ROLL_ACTIONS.map((action) => [
          action,
          resolveQuickRollAction(activeSheetView?.parentSheet, actions, action)
        ])
      ) as Record<QuickRollAction, ReturnType<typeof resolveQuickRollAction>>,
    [activeSheetView?.parentSheet, actions]
  );
  const selectedQuickActionResolution = selectedQuickAction
    ? quickActionResolutions[selectedQuickAction]
    : null;

  const submit = (): void => {
    if (!activeSheetId || !selectedQuickActionResolution) {
      return;
    }

    const execution = buildQuickRollExecutionRequest({
      sheetId: activeSheetId,
      resolution: selectedQuickActionResolution,
      rollMode,
      visibility: mode === "gm" ? visibility : "public"
    });
    client.sendProtocolRequest(execution.request, execution.label);
  };

  const selectedActionLabel = selectedQuickActionResolution
    ? selectedQuickActionResolution.actionName
    : selectedQuickAction
      ? getQuickRollLabel(selectedQuickAction, activeWeapon)
      : null;
  const canSubmit = Boolean(activeSheetId && selectedQuickActionResolution);
  const bridgeStatusLabel =
    roll20Bridge.status === "connected"
      ? "Roll20 connected"
      : roll20Bridge.status === "disconnected"
        ? "Roll20 disconnected"
        : "Roll20 unknown";

  return (
    <Panel title="Quick Actions">
      <div className="stack">
        <div className="status-row roll-panel__meta">
          <span className="pill">sheet: {activeSheetName}</span>
          <span className={`pill roll20-bridge-pill roll20-bridge-pill--${roll20Bridge.status}`}>
            {bridgeStatusLabel}
          </span>
          {selectedActionLabel ? <span className="pill">action: {selectedActionLabel}</span> : null}
        </div>
        <div className="quick-roll-row">
          {QUICK_ROLL_ACTIONS.map((action) => (
            <button
              key={action}
              className={`quick-roll-btn ${selectedQuickAction === action ? "quick-roll-btn--active" : ""}`}
              onClick={() => setSelectedQuickAction(action)}
              disabled={!quickActionResolutions[action]}
              title={
                quickActionResolutions[action]
                  ? `Select ${quickActionResolutions[action]?.actionName}`
                  : "This sheet does not have that action assigned"
              }
            >
              {getQuickRollLabel(action, activeWeapon)}
            </button>
          ))}
        </div>
        <div className="inline-group">
          <Field label="Roll Mode">
            <select
              value={rollMode}
              onChange={(event) => setRollMode(event.target.value as QuickRollMode)}
            >
              <option value="normal">Normal</option>
              <option value="advantage">Advantage</option>
              <option value="disadvantage">Disadvantage</option>
            </select>
          </Field>
          {mode === "gm" ? (
            <Field label="Output Visibility">
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as QuickRollVisibility)}
              >
                <option value="public">Public</option>
                <option value="gm_only">GM only</option>
              </select>
            </Field>
          ) : null}
        </div>
        <div className="roll-panel__footer">
          <div className="equation-preview">
            <span className="muted">Action Request</span>
            {selectedQuickActionResolution ? (
              <code>
                perform_action: {activeSheetId} / {selectedQuickActionResolution.actionId}
              </code>
            ) : selectedQuickAction ? (
              <code>Selected quick action is not assigned to this sheet.</code>
            ) : (
              <code>Select an assigned action.</code>
            )}
          </div>
          <button className="button" onClick={submit} disabled={!canSubmit}>
            Perform Action
          </button>
          <button
            className="button button--secondary"
            type="button"
            onClick={() =>
              client.sendProtocolRequest(
                buildGetRoll20BridgeStatusRequest(),
                "Roll20 bridge status"
              )
            }
          >
            Check Bridge
          </button>
        </div>
        {roll20Bridge.lastError ? (
          <p className="error-text roll-panel__bridge-error">{roll20Bridge.lastError}</p>
        ) : null}
      </div>
    </Panel>
  );
}
