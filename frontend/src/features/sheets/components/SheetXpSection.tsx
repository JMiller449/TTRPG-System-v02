import { useEffect, useMemo, useState } from "react";
import type { Sheet } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";

interface XpTargetRow {
  sheet: Sheet;
  count: number;
  xp: number;
}

function parseXpCap(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function SheetXpSection({
  mode,
  sheet,
  sheets,
  sheetOrder,
  onSetSlayedCount
}: {
  mode: "player" | "gm";
  sheet: Sheet;
  sheets: Record<string, Sheet>;
  sheetOrder: string[];
  onSetSlayedCount: (slayedSheetId: string, count: number) => void;
}): JSX.Element {
  const rows = useMemo<XpTargetRow[]>(
    () =>
      sheetOrder
        .map((sheetId) => sheets[sheetId])
        .filter((target): target is Sheet => Boolean(target) && target.id !== sheet.id)
        .filter((target) => target.xp_given_when_slayed > 0)
        .map((target) => {
          const count = sheet.slayed_record[target.id]?.count ?? 0;
          return {
            sheet: target,
            count,
            xp: count * target.xp_given_when_slayed
          };
        }),
    [sheet.id, sheet.slayed_record, sheetOrder, sheets]
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts((current) => {
      const next: Record<string, string> = {};
      for (const row of rows) {
        next[row.sheet.id] = current[row.sheet.id] ?? String(row.count);
      }
      return next;
    });
  }, [rows]);

  const totalXp = rows.reduce((sum, row) => sum + row.xp, 0);
  const xpCap = parseXpCap(sheet.xp_cap);
  const remainingXp = xpCap === null ? null : Math.max(0, xpCap - totalXp);

  if (rows.length === 0) {
    return <EmptyState message="No XP-bearing sheets are available." />;
  }

  return (
    <section className="character-sheet__section sheet-xp-section" aria-labelledby="sheet-xp-heading">
      <div className="sheet-xp-section__header">
        <div>
          <h4 id="sheet-xp-heading">XP Tracker</h4>
          {mode === "gm" ? (
            <p className="character-sheet__hint muted">
              {xpCap === null
                ? `${totalXp} XP tracked. Set a numeric XP needed value on the sheet to show readiness.`
                : `${totalXp} / ${xpCap} XP tracked${
                    remainingXp === 0 ? " · ready for GM review" : ` · ${remainingXp} remaining`
                  }.`}
            </p>
          ) : (
            <p className="character-sheet__hint muted">Tracked defeat counts for GM review.</p>
          )}
        </div>
      </div>

      <div className="sheet-xp-grid">
        {rows.map((row) => {
          const draft = drafts[row.sheet.id] ?? String(row.count);
          const parsedDraft = Number(draft);
          const canSave =
            Number.isInteger(parsedDraft) && parsedDraft >= 0 && parsedDraft !== row.count;
          return (
            <article className="sheet-xp-card" key={row.sheet.id}>
              <div>
                <strong>{row.sheet.name}</strong>
                {mode === "gm" ? (
                  <p className="muted">{row.sheet.xp_given_when_slayed} XP each</p>
                ) : null}
              </div>
              <label className="sheet-xp-card__count">
                <span>Count</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={draft}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [row.sheet.id]: event.target.value
                    }))
                  }
                />
              </label>
              {mode === "gm" ? <span className="sheet-xp-card__xp">{row.xp} XP</span> : null}
              <button
                type="button"
                className="secondary"
                disabled={!canSave}
                onClick={() => onSetSlayedCount(row.sheet.id, parsedDraft)}
              >
                Save
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
