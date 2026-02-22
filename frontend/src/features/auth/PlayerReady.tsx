import { useMemo } from "react";
import { useAppStore } from "@/app/state/store";
import type { GameClient } from "@/hooks/useGameClient";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

export function PlayerReady({ client }: { client: GameClient }): JSX.Element {
  const {
    state: { activeSheetId, instances },
    dispatch
  } = useAppStore();

  const activePlayer = useMemo(() => {
    if (!activeSheetId) {
      return null;
    }
    const instance = instances[activeSheetId];
    if (!instance || instance.kind !== "player") {
      return null;
    }
    return instance;
  }, [activeSheetId, instances]);

  if (!activePlayer) {
    return (
      <div className="landing-shell">
        <div className="landing-card">
          <Panel title="Player Ready">
            <p className="muted">Select a player character first.</p>
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-shell">
      <div className="landing-card">
        <h1>Player Ready</h1>
        <p className="muted">Confirm your selected character before entering the player console.</p>

        <Panel title="Selected Character">
          <div className="stack">
            <p>
              <strong>{activePlayer.name}</strong>
            </p>
            <p className="muted">Sheet ID: {activePlayer.id}</p>
            <div className="inline-actions">
              <button
                className="button"
                onClick={() => dispatch({ type: "set_player_console_entered_sheet", sheetId: activePlayer.id })}
              >
                Enter Player Console
              </button>
              <button
                className="button button--secondary"
                onClick={() => {
                  dispatch({ type: "set_player_console_entered_sheet", sheetId: null });
                  client.sendIntent({
                    intentId: makeId("intent"),
                    type: "set_active_sheet",
                    payload: { sheetId: null }
                  });
                }}
              >
                Choose Different Character
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
