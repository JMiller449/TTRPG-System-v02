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
  const { actions, items } = state.serverState;

  const [selectedQuickAction, setSelectedQuickAction] = useState<QuickRollAction | null>(null);
  const [rollMode, setRollMode] = useState<ActionRollMode>("normal");

  const activeSheetView = useMemo(() => {
    if (!activeSheetId) {
      return null;
    }
    return selectSheetInstanceView(state, activeSheetId);
  }, [activeSheetId, state]);
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

  const canSubmit = Boolean(activeSheetId && selectedQuickActionResolution);

  return (
    <Panel title="Quick Actions">
      <div className="stack">
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
              {getQuickRollLabel(action)}
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
            <span className="muted">Selected Action</span>
            {selectedQuickActionResolution ? (
              <p>
                <strong>{selectedQuickActionResolution.actionName}</strong>
                <span className="equation-preview__meta">Mode: {effectiveRollMode}</span>
              </p>
            ) : selectedQuickAction ? (
              <p>Selected quick action is not assigned to this sheet.</p>
            ) : (
              <p>Select an assigned action.</p>
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
      </div>
    </Panel>
  );
}
