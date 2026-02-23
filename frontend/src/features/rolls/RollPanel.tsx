import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
import { ALL_STATS, STAT_LABELS } from "@/domain/stats";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";
import type { GameClient } from "@/hooks/useGameClient";
import type { RollVisibility, StatKey } from "@/domain/models";
import {
  getQuickRollContext,
  getRollEquationPreview,
  getQuickRollLabel,
  QUICK_ROLL_ACTIONS,
  type QuickRollAction
} from "@/features/rolls/quickRolls";

type RollPanelMode = "gm" | "player";

export function RollPanel({
  client,
  mode = "gm"
}: {
  client: GameClient;
  mode?: RollPanelMode;
}): JSX.Element {
  const {
    state: { activeSheetId, instances, itemTemplates, localSheetEquipment, localSheetActiveWeapon }
  } = useAppStore();

  const [stat, setStat] = useState<StatKey>("strength");
  const [context, setContext] = useState("");
  const [visibility, setVisibility] = useState<RollVisibility>("visible");
  const [selectedQuickAction, setSelectedQuickAction] = useState<QuickRollAction | null>(null);

  const activeSheetName = useMemo(() => {
    if (!activeSheetId) {
      return "None";
    }
    return instances[activeSheetId]?.name ?? activeSheetId;
  }, [activeSheetId, instances]);
  const activeWeapon = useMemo(() => {
    if (!activeSheetId) {
      return null;
    }
    const activeEntryId = localSheetActiveWeapon[activeSheetId] ?? null;
    if (!activeEntryId) {
      return null;
    }
    const entry = (localSheetEquipment[activeSheetId] ?? []).find((item) => item.id === activeEntryId);
    if (!entry) {
      return null;
    }
    return itemTemplates[entry.itemTemplateId]?.name ?? null;
  }, [activeSheetId, itemTemplates, localSheetEquipment, localSheetActiveWeapon]);

  const submit = (): void => {
    if (!activeSheetId) {
      return;
    }

    client.submitRoll({
      sheetId: activeSheetId,
      stat,
      context: context.trim(),
      visibility: mode === "player" ? "visible" : visibility
    });
    setContext("");
  };

  const title = mode === "player" ? "Roll Composer" : "Roll";
  const statLabel = mode === "player" ? "Stat" : "Governing Stat";

  return (
    <Panel title={title}>
      <div className="stack">
        <p className="muted">Active Sheet: {activeSheetName}</p>
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
        <p className="muted">
          Quick-roll buttons prefill context only. TODO: backend will apply authoritative roll modifiers.
        </p>
        <div className="equation-preview">
          <span className="muted">Roll Equation</span>
          <code>{getRollEquationPreview(stat, selectedQuickAction, activeWeapon)}</code>
          <p className="muted">
            TODO: replace placeholders with backend-authoritative dice and action formulas.
          </p>
        </div>
        <Field label={statLabel}>
          <select value={stat} onChange={(event) => setStat(event.target.value as StatKey)}>
            {ALL_STATS.map((entry) => (
              <option key={entry} value={entry}>
                {STAT_LABELS[entry]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Context">
          <input
            value={context}
            onChange={(event) => setContext(event.target.value)}
            placeholder={mode === "player" ? "e.g. Jumping the broken bridge" : "e.g. Acrobatics jump over ravine"}
          />
        </Field>

        {mode === "gm" ? (
          <Field label="Visibility">
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as RollVisibility)}>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden (GM)</option>
            </select>
          </Field>
        ) : (
          <p className="muted">Visibility: visible (player rolls)</p>
        )}

        <button className="button" onClick={submit} disabled={!activeSheetId}>
          Submit Roll Intent
        </button>

        {/* TODO: backend may require roll-type specific payload fields; align once request schema is finalized. */}
      </div>
    </Panel>
  );
}
