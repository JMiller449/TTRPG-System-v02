import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { selectSheetInstanceView } from "@/app/state/selectors";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildGetRoll20BridgeStatusRequest,
  type ActionRollMode
} from "@/infrastructure/ws/requestBuilders";
import { actionRollModes } from "@/features/rolls/actionRollModes";
import { RollModeControl } from "@/features/rolls/RollModeControl";
import {
  buildQuickRollExecutionRequest,
  getQuickRollLabel,
  QUICK_ROLL_ACTIONS,
  resolveQuickRollAction,
  type QuickRollAction
} from "@/features/rolls/quickRolls";
import { Panel } from "@/shared/ui/Panel";

export function RollPanel({ client }: { client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const { activeSheetId } = state.uiState;
  const { roll20Bridge } = state.uiState;
  const { actions, items } = state.serverState;

  const [selectedQuickAction, setSelectedQuickAction] = useState<QuickRollAction | null>(null);
  const [rollMode, setRollMode] = useState<ActionRollMode>("normal");

  const activeSheetView = useMemo(() => {
    if (!activeSheetId) {
      return null;
    }
    return selectSheetInstanceView(state, activeSheetId);
  }, [activeSheetId, state]);
  const activeSheetName = activeSheetView?.name ?? activeSheetId ?? "None";
  const quickActionResolutions = useMemo(
    () =>
      Object.fromEntries(
        QUICK_ROLL_ACTIONS.map((action) => [
          action,
          resolveQuickRollAction(activeSheetView?.parentSheet, actions, action, items)
        ])
      ) as Record<QuickRollAction, ReturnType<typeof resolveQuickRollAction>>,
    [activeSheetView?.parentSheet, actions, items]
  );
  const selectedQuickActionResolution = selectedQuickAction
    ? quickActionResolutions[selectedQuickAction]
    : null;
  const selectedModeKind = selectedQuickActionResolution
    ? (actions[selectedQuickActionResolution.actionId]?.roll_mode_kind ?? "none")
    : "none";
  const allowedRollModes = actionRollModes(selectedModeKind);
  const effectiveRollMode = allowedRollModes.includes(rollMode) ? rollMode : "normal";

  const submit = (): void => {
    if (!activeSheetId || !selectedQuickActionResolution) {
      return;
    }

    const execution = buildQuickRollExecutionRequest({
      sheetId: activeSheetId,
      resolution: selectedQuickActionResolution,
      rollMode: effectiveRollMode
    });
    client.sendProtocolRequest(execution.request, execution.label);
  };

  const selectedActionLabel = selectedQuickActionResolution
    ? selectedQuickActionResolution.actionName
    : selectedQuickAction
      ? getQuickRollLabel(selectedQuickAction, null)
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
              {getQuickRollLabel(action, null)}
            </button>
          ))}
        </div>
        <RollModeControl
          value={effectiveRollMode}
          modeKind={selectedModeKind}
          onChange={setRollMode}
        />
        <div className="roll-panel__footer">
          <div className="equation-preview">
            <span className="muted">Action Request</span>
            {selectedQuickActionResolution ? (
              <code>
                perform_action: {activeSheetId} / {selectedQuickActionResolution.actionId} /{" "}
                {effectiveRollMode}
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
