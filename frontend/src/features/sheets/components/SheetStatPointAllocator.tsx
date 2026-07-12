import { useEffect, useMemo, useState } from "react";
import type { SheetStatKey } from "@/features/sheets/sheetDisplay";
import { ALL_STATS } from "@/domain/stats";
import { DISPLAY_NAMES } from "@/features/sheets/sheetDisplay";
import {
  createEmptyStatPointAllocation,
  decrementStatPointAllocation,
  incrementStatPointAllocation,
  positiveStatPointAllocationPayload,
  sumStatPointAllocation,
  type StatPointAllocation
} from "@/features/sheets/statPointAllocation";

export function SheetStatPointAllocator({
  instanceId,
  stats,
  unassignedPoints,
  onCommit
}: {
  instanceId: string;
  stats: Partial<Record<SheetStatKey, number>>;
  unassignedPoints: number;
  onCommit: (allocations: Record<string, number>) => void;
}): JSX.Element | null {
  const availablePoints = Math.max(0, unassignedPoints);
  const [allocation, setAllocation] = useState<StatPointAllocation>(() =>
    createEmptyStatPointAllocation()
  );
  const spentPoints = useMemo(() => sumStatPointAllocation(allocation), [allocation]);
  const remainingPoints = Math.max(0, availablePoints - spentPoints);

  useEffect(() => {
    setAllocation(createEmptyStatPointAllocation());
  }, [availablePoints, instanceId]);

  if (availablePoints <= 0) {
    return null;
  }

  return (
    <section className="character-sheet__section stat-point-allocator">
      <header className="stat-point-allocator__header">
        <div>
          <h4>Unassigned Stat Points</h4>
          <p className="muted character-sheet__hint">
            {remainingPoints} of {availablePoints} available · substat points are permanent bonuses
          </p>
        </div>
        <button
          type="button"
          className="button"
          disabled={spentPoints <= 0}
          onClick={() => {
            onCommit(positiveStatPointAllocationPayload(allocation));
            setAllocation(createEmptyStatPointAllocation());
          }}
        >
          Lock In
        </button>
      </header>
      <div className="stat-point-allocator__grid">
        {ALL_STATS.map((key) => {
          const baseValue = stats[key] ?? 0;
          const addedValue = allocation[key];
          return (
            <div className="stat-point-allocator__row" key={key}>
              <span className="stat-point-allocator__label">{DISPLAY_NAMES[key]}</span>
              <span
                className="stat-point-allocator__value"
                aria-label={`${DISPLAY_NAMES[key]} preview`}
              >
                {baseValue + addedValue}
              </span>
              <span className="stat-point-allocator__delta">+{addedValue}</span>
              <div className="stat-point-allocator__actions">
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={addedValue <= 0}
                  aria-label={`Remove staged ${DISPLAY_NAMES[key]} point`}
                  onClick={() =>
                    setAllocation((current) => decrementStatPointAllocation(current, key))
                  }
                >
                  -
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={remainingPoints <= 0}
                  aria-label={`Add ${DISPLAY_NAMES[key]} point`}
                  onClick={() =>
                    setAllocation((current) =>
                      incrementStatPointAllocation(current, key, availablePoints)
                    )
                  }
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
