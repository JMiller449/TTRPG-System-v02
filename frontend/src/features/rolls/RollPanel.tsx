import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
import { selectActiveWeaponLabel, selectSheetInstanceView } from "@/app/state/selectors";
import { ALL_STATS, STAT_LABELS } from "@/domain/stats";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";
import type { GameClient } from "@/hooks/useGameClient";
import type { CommonDieSides, RollVisibility, StatKey } from "@/domain/models";
import {
  getRollEquationPreview,
  getQuickRollLabel,
  formatDiceExpression,
  QUICK_ROLL_ACTIONS,
  type QuickRollAction
} from "@/features/rolls/quickRolls";

type RollPanelMode = "gm" | "player";
type RollEdge = "normal" | "advantage" | "disadvantage";
type ComposerMode = "stat" | "dice";

const COMMON_DICE: readonly CommonDieSides[] = [4, 6, 8, 10, 12, 20, 100];

function getRollEdgePreview(edge: RollEdge): string {
  switch (edge) {
    case "advantage":
      return "[ADVANTAGE_TODO]";
    case "disadvantage":
      return "[DISADVANTAGE_TODO]";
    default:
      return "[NORMAL]";
  }
}

export function RollPanel({
  client,
  mode = "gm"
}: {
  client: GameClient;
  mode?: RollPanelMode;
}): JSX.Element {
  const {
    state
  } = useAppStore();
  const { activeSheetId } = state;

  const [composerMode, setComposerMode] = useState<ComposerMode>("stat");
  const [stat, setStat] = useState<StatKey>("strength");
  const [visibility, setVisibility] = useState<RollVisibility>("visible");
  const [rollEdge, setRollEdge] = useState<RollEdge>("normal");
  const [selectedQuickAction, setSelectedQuickAction] = useState<QuickRollAction | null>(null);
  const [diceCount, setDiceCount] = useState<number>(1);
  const [diceSides, setDiceSides] = useState<CommonDieSides>(20);

  const activeSheetName = useMemo(() => {
    if (!activeSheetId) {
      return "None";
    }
    return selectSheetInstanceView(state, activeSheetId)?.name ?? activeSheetId;
  }, [activeSheetId, state]);
  const activeWeapon = useMemo(() => {
    if (!activeSheetId) {
      return null;
    }
    const label = selectActiveWeaponLabel(state, activeSheetId);
    return label === "None" ? null : label;
  }, [activeSheetId, state]);
  const showVisibilityControls = mode === "gm";

  const submit = (): void => {
    if (!activeSheetId) {
      return;
    }

    if (composerMode === "dice") {
      client.submitRoll({
        kind: "dice",
        sheetId: activeSheetId,
        count: Math.max(1, diceCount),
        sides: diceSides,
        visibility: showVisibilityControls ? visibility : "visible"
      });
      return;
    }

    client.submitRoll({
      kind: "stat",
      sheetId: activeSheetId,
      stat,
      visibility: showVisibilityControls ? visibility : "visible"
    });
  };

  const title = mode === "player" ? "Roll Composer" : "Roll";
  const statLabel = mode === "player" ? "Stat" : "Governing Stat";
  const selectedActionLabel = selectedQuickAction ? getQuickRollLabel(selectedQuickAction, activeWeapon) : null;

  return (
    <Panel title={title}>
      <div className="stack">
        <div className="status-row roll-panel__meta">
          <span className="pill">sheet: {activeSheetName}</span>
          <span className="pill">mode: {composerMode === "stat" ? "stat check" : "dice roll"}</span>
          {selectedActionLabel ? <span className="pill">action: {selectedActionLabel}</span> : null}
        </div>
        <div className="inline-group roll-panel__controls">
          <Field label="Roll Type">
            <select value={composerMode} onChange={(event) => setComposerMode(event.target.value as ComposerMode)}>
              <option value="stat">Stat Check</option>
              <option value="dice">Simple Dice Roll</option>
            </select>
          </Field>
          {composerMode === "stat" ? (
            <Field label={statLabel}>
              <select value={stat} onChange={(event) => setStat(event.target.value as StatKey)}>
                {ALL_STATS.map((entry) => (
                  <option key={entry} value={entry}>
                    {STAT_LABELS[entry]}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Dice">
              <input
                type="number"
                min={1}
                max={20}
                value={diceCount}
                onChange={(event) => setDiceCount(Math.max(1, Number(event.target.value) || 1))}
              />
            </Field>
          )}
          {composerMode === "stat" ? (
            <Field label="Edge">
              <select value={rollEdge} onChange={(event) => setRollEdge(event.target.value as RollEdge)}>
                <option value="normal">Normal</option>
                <option value="advantage">Advantage</option>
                <option value="disadvantage">Disadvantage</option>
              </select>
            </Field>
          ) : (
            <Field label="Sides">
              <select
                value={diceSides}
                onChange={(event) => setDiceSides(Number(event.target.value) as CommonDieSides)}
              >
                {COMMON_DICE.map((sides) => (
                  <option key={sides} value={sides}>
                    d{sides}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {showVisibilityControls ? (
            <Field label="Visibility">
              <select value={visibility} onChange={(event) => setVisibility(event.target.value as RollVisibility)}>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden (GM)</option>
              </select>
            </Field>
          ) : null}
        </div>
        {composerMode === "stat" ? (
          <>
            <div className="quick-roll-row">
              {QUICK_ROLL_ACTIONS.map((action) => (
                <button
                  key={action}
                  className={`quick-roll-btn ${selectedQuickAction === action ? "quick-roll-btn--active" : ""}`}
                  onClick={() => {
                    setSelectedQuickAction(action);
                  }}
                >
                  {getQuickRollLabel(action, activeWeapon)}
                </button>
              ))}
            </div>
          </>
        ) : null}
        <div className="roll-panel__footer">
          <div className="equation-preview">
            <span className="muted">{composerMode === "dice" ? "Dice Expression" : "Roll Equation"}</span>
            {composerMode === "dice" ? (
              <code>{formatDiceExpression(diceCount, diceSides)}</code>
            ) : (
              <code>
                {getRollEquationPreview(stat, selectedQuickAction, activeWeapon)} + {getRollEdgePreview(rollEdge)}
              </code>
            )}
          </div>
          <button className="button" onClick={submit} disabled={!activeSheetId}>
            {composerMode === "dice" ? "Roll Dice" : "Submit Roll"}
          </button>
        </div>

        {/* TODO: backend may require dedicated dice-roll and edge fields; align once request schema is finalized. */}
      </div>
    </Panel>
  );
}
