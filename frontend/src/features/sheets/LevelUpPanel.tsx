import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
import { ALL_STATS, STAT_LABELS } from "@/domain/stats";
import type { StatKey } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Panel } from "@/shared/ui/Panel";

function toDraftValues(values: Partial<Record<StatKey, number>>): Record<StatKey, string> {
  return Object.fromEntries(
    ALL_STATS.map((key) => [key, String(values[key] ?? 0)])
  ) as Record<StatKey, string>;
}

export function LevelUpPanel(): JSX.Element {
  const {
    state: { activeSheetId, instances, templates, localSheetStatOverrides },
    dispatch
  } = useAppStore();

  const detail = useMemo(() => {
    if (!activeSheetId) {
      return null;
    }
    const instance = instances[activeSheetId];
    if (!instance) {
      return null;
    }
    const template = templates[instance.templateId];
    const baseStats = template?.stats ?? {};
    const overrides = localSheetStatOverrides[instance.id] ?? {};
    const effective = { ...baseStats, ...overrides };
    return { instance, template, baseStats, effective };
  }, [activeSheetId, instances, templates, localSheetStatOverrides]);

  const [draftValues, setDraftValues] = useState<Record<StatKey, string>>(() => toDraftValues({}));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!detail) {
      setDraftValues(toDraftValues({}));
      setLocalError(null);
      return;
    }
    setDraftValues(toDraftValues(detail.effective));
    setLocalError(null);
  }, [detail]);

  if (!detail) {
    return (
      <Panel title="Level-Up Editor">
        <EmptyState message="Select an active sheet to edit manual level-up values." />
      </Panel>
    );
  }

  const applyDraft = (): void => {
    const nextOverrides: Partial<Record<StatKey, number>> = {};
    for (const key of ALL_STATS) {
      const raw = draftValues[key].trim();
      if (!raw) {
        continue;
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        setLocalError(`Invalid number for ${STAT_LABELS[key]}.`);
        return;
      }

      const base = detail.baseStats[key] ?? 0;
      if (parsed !== base) {
        nextOverrides[key] = parsed;
      }
    }

    dispatch({ type: "set_sheet_stat_overrides", sheetId: detail.instance.id, overrides: nextOverrides });
    setLocalError(null);
  };

  return (
    <Panel title="Level-Up Editor (Manual Values)">
      <div className="stack">
        <p className="muted">
          Active Sheet: <strong>{detail.instance.name}</strong>
        </p>
        <p className="muted">
          Manual values only. TODO: persist and validate through backend once update contracts are finalized.
        </p>

        <div className="level-grid">
          {ALL_STATS.map((key) => (
            <label key={key} className="field">
              <span className="field__label">{STAT_LABELS[key]}</span>
              <input
                type="number"
                value={draftValues[key]}
                onChange={(event) =>
                  setDraftValues((prev) => ({
                    ...prev,
                    [key]: event.target.value
                  }))
                }
                placeholder="0"
              />
            </label>
          ))}
        </div>

        <div className="level-actions">
          <button className="button" onClick={applyDraft}>
            Apply Manual Values
          </button>
          <button
            className="button button--secondary"
            onClick={() => {
              setDraftValues(toDraftValues(detail.effective));
              setLocalError(null);
            }}
          >
            Reset Draft
          </button>
          <button
            className="button button--secondary"
            onClick={() => {
              dispatch({ type: "clear_sheet_stat_overrides", sheetId: detail.instance.id });
              setDraftValues(toDraftValues(detail.baseStats));
              setLocalError(null);
            }}
          >
            Clear Manual Overrides
          </button>
        </div>
        {localError ? <p className="error-text">{localError}</p> : null}
      </div>
    </Panel>
  );
}
