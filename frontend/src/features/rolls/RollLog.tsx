import { useState } from "react";
import { useAppStore } from "@/app/state/store";
import { ALL_STATS, STAT_LABELS } from "@/domain/stats";
import type { StatKey } from "@/domain/models";
import {
  getQuickRollContext,
  getRollEquationPreview,
  getQuickRollLabel,
  QUICK_ROLL_ACTIONS,
  type QuickRollAction
} from "@/features/rolls/quickRolls";
import type { GameClient } from "@/hooks/useGameClient";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";

type RollEdge = "normal" | "advantage" | "disadvantage";

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

export function RollLog({
  sheetId,
  client
}: {
  sheetId?: string | null;
  client?: GameClient;
} = {}): JSX.Element {
  const {
    state: { rollLog, role, itemTemplates, localSheetEquipment, localSheetActiveWeapon }
  } = useAppStore();
  const [stat, setStat] = useState<StatKey>("strength");
  const [context, setContext] = useState("");
  const [rollEdge, setRollEdge] = useState<RollEdge>("normal");
  const [selectedQuickAction, setSelectedQuickAction] = useState<QuickRollAction | null>(null);
  const entries = sheetId ? rollLog.filter((entry) => entry.request.sheetId === sheetId) : rollLog;
  const showPlayerComposer = role === "player" && Boolean(client) && Boolean(sheetId);
  const activeWeapon = (() => {
    if (!sheetId) {
      return null;
    }
    const activeEntryId = localSheetActiveWeapon[sheetId] ?? null;
    if (!activeEntryId) {
      return null;
    }
    const entry = (localSheetEquipment[sheetId] ?? []).find((item) => item.id === activeEntryId);
    if (!entry) {
      return null;
    }
    return itemTemplates[entry.itemTemplateId]?.name ?? null;
  })();

  const submitPlayerRoll = (): void => {
    if (!client || !sheetId) {
      return;
    }
    client.submitRoll({
      sheetId,
      stat,
      context: context.trim(),
      visibility: "visible"
    });
    setContext("");
  };

  return (
    <Panel title="Roll Log">
      <div className="list">
        {showPlayerComposer ? (
          <article className="list-item list-item--block">
            <div className="stack">
              <strong>Roll Composer</strong>
              <div className="quick-roll-row">
                {QUICK_ROLL_ACTIONS.map((action) => (
                  <button
                    key={action}
                    className={`quick-roll-btn ${selectedQuickAction === action ? "quick-roll-btn--active" : ""}`}
                    onClick={() => {
                      setSelectedQuickAction(action);
                      setContext(getQuickRollContext(action, activeWeapon));
                    }}
                  >
                    {getQuickRollLabel(action, activeWeapon)}
                  </button>
                ))}
              </div>
              <Field label="Stat">
                <select value={stat} onChange={(event) => setStat(event.target.value as StatKey)}>
                  {ALL_STATS.map((entry) => (
                    <option key={entry} value={entry}>
                      {STAT_LABELS[entry]}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="equation-preview">
                <span className="muted">Roll Equation</span>
                <code>
                  {getRollEquationPreview(stat, selectedQuickAction, activeWeapon)} +{" "}
                  {getRollEdgePreview(rollEdge)}
                </code>
                <p className="muted">
                  TODO: replace placeholders with backend-authoritative dice and action formulas.
                </p>
              </div>
              <Field label="Roll Edge">
                <select value={rollEdge} onChange={(event) => setRollEdge(event.target.value as RollEdge)}>
                  <option value="normal">Normal</option>
                  <option value="advantage">Advantage</option>
                  <option value="disadvantage">Disadvantage</option>
                </select>
              </Field>
              <p className="muted">
                Roll edge is currently UI-only scaffolding until backend roll-intent schema adds an explicit edge
                field.
              </p>
              <Field label="Context">
                <input
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  placeholder="e.g. Sprinting to cover"
                />
              </Field>
              <button className="button" onClick={submitPlayerRoll}>
                Submit Roll Intent
              </button>
              <p className="muted">
                Quick-roll buttons prefill context only. TODO: backend will apply authoritative roll modifiers.
              </p>
              <p className="muted">Visibility: visible (player rolls)</p>
            </div>
          </article>
        ) : null}
        {entries.length === 0 ? <EmptyState message="No rolls yet." /> : null}
        {entries.map((entry) => {
          const isHiddenToPlayer = role === "player" && entry.request.visibility === "hidden";
          return (
            <article key={entry.id} className="list-item list-item--block">
              <div className="list-item__top">
                <strong>{isHiddenToPlayer ? "Hidden GM Roll" : `${entry.request.stat} check`}</strong>
                <span className={`pill pill--${entry.status}`}>{entry.status}</span>
              </div>
              <div className="muted">{new Date(entry.createdAt).toLocaleString()}</div>
              {!isHiddenToPlayer ? (
                <>
                  <div className="muted">context: {entry.request.context || "(none)"}</div>
                  <div>{entry.resultText ?? entry.error ?? "Awaiting result..."}</div>
                </>
              ) : null}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
