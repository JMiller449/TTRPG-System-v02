import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Resistances } from "@/domain/models";
import {
  CORE_SUBSTAT_GROUPS,
  DISPLAY_NAMES,
  type CoreStatKey,
  type SheetStatKey
} from "@/domain/stats";
import { RESISTANCE_FIELDS } from "@/features/sheets/sheetDefinitionEditing";
import {
  createEmptyStatPointAllocation,
  decrementStatPointAllocation,
  incrementStatPointAllocation,
  positiveStatPointAllocationPayload,
  sumStatPointAllocation,
  type StatPointAllocation
} from "@/features/sheets/statPointAllocation";

const CORE_ABBREVIATIONS: Record<CoreStatKey, string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  perception: "PER",
  arcane: "ARC",
  will: "WIL"
};

const DENSE_CORE_STAT_KEYS: readonly CoreStatKey[] = [
  "strength",
  "dexterity",
  "constitution",
  "arcane",
  "will",
  "perception"
];

const SUBSTATS = CORE_SUBSTAT_GROUPS.flatMap((group) => group.subs).sort((left, right) =>
  DISPLAY_NAMES[left].localeCompare(DISPLAY_NAMES[right])
);

export function SheetDenseOverview({
  mode,
  instanceId,
  stats,
  unassignedPoints,
  resistances,
  actions,
  kills,
  statuses,
  attributes,
  proficiencies,
  inventory,
  onAllocateStatPoints,
  onAddCoreStatPoints
}: {
  mode: "player" | "gm";
  instanceId: string;
  stats: Partial<Record<SheetStatKey, number>>;
  unassignedPoints: number;
  resistances?: Resistances;
  actions: ReactNode;
  kills: ReactNode;
  statuses: ReactNode;
  attributes: ReactNode;
  proficiencies: ReactNode;
  inventory: ReactNode;
  onAllocateStatPoints: (allocations: Record<string, number>) => void;
  onAddCoreStatPoints: (stat: CoreStatKey) => void;
}): JSX.Element {
  const availablePoints = Math.max(0, unassignedPoints);
  const [allocation, setAllocation] = useState<StatPointAllocation>(() =>
    createEmptyStatPointAllocation()
  );
  const spentPoints = useMemo(() => sumStatPointAllocation(allocation), [allocation]);
  const remainingPoints = Math.max(0, availablePoints - spentPoints);

  useEffect(() => {
    setAllocation(createEmptyStatPointAllocation());
  }, [availablePoints, instanceId]);

  return (
    <div className="dense-sheet">
      <div className="dense-sheet__left">
        <section className="dense-panel dense-stats" aria-labelledby="dense-stats-title">
          <header className="dense-panel__header dense-stats__header">
            <strong id="dense-stats-title">Core Stats</strong>
            <span>
              {mode === "player"
                ? `${remainingPoints} of ${availablePoints} unspent`
                : "GM point grants"}
            </span>
            {mode === "player" ? (
              <button
                type="button"
                className="button"
                disabled={spentPoints === 0}
                onClick={() => {
                  onAllocateStatPoints(positiveStatPointAllocationPayload(allocation));
                  setAllocation(createEmptyStatPointAllocation());
                }}
              >
                Lock In {spentPoints > 0 ? spentPoints : ""}
              </button>
            ) : null}
          </header>
          <div className="dense-stats__cores">
            {DENSE_CORE_STAT_KEYS.map((key) => {
              const staged = allocation[key];
              const currentValue = stats[key] ?? 0;
              return (
                <article className="dense-stat-card" key={key}>
                  <strong>{CORE_ABBREVIATIONS[key]}</strong>
                  <div>
                    <button
                      type="button"
                      disabled={mode === "gm" || staged <= 0}
                      aria-label={`Remove staged ${DISPLAY_NAMES[key]} point`}
                      onClick={() =>
                        setAllocation((current) => decrementStatPointAllocation(current, key))
                      }
                    >
                      −
                    </button>
                    <output aria-label={`${DISPLAY_NAMES[key]} preview`}>
                      {currentValue + staged}
                    </output>
                    <button
                      type="button"
                      disabled={mode === "player" ? remainingPoints <= 0 : false}
                      aria-label={
                        mode === "player"
                          ? `Add ${DISPLAY_NAMES[key]} point`
                          : `Grant ${DISPLAY_NAMES[key]} points`
                      }
                      onClick={() => {
                        if (mode === "gm") {
                          onAddCoreStatPoints(key);
                          return;
                        }
                        setAllocation((current) =>
                          incrementStatPointAllocation(current, key, availablePoints)
                        );
                      }}
                    >
                      +
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="dense-stats__substats">
            {SUBSTATS.map((key) => (
              <div className="dense-substat" key={key}>
                <span>{DISPLAY_NAMES[key]}</span>
                <strong>
                  {stats[key] ?? "—"}
                  {key === "carry_weight" && stats[key] !== undefined ? " lb" : ""}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section
          className="dense-panel dense-resistances"
          aria-labelledby="dense-resistances-title"
        >
          <header className="dense-panel__header">
            <strong id="dense-resistances-title">Resistances</strong>
            <span>Current defense</span>
          </header>
          <div className="dense-resistances__core" aria-label="Core resistance modifiers">
            {RESISTANCE_FIELDS.slice(0, 3).map(([key, label]) => (
              <div key={key}>
                <span>{label}</span>
                <strong>{Number(((resistances?.[key] ?? 0) * 100).toFixed(2))}%</strong>
              </div>
            ))}
          </div>
          <div className="dense-resistances__grid">
            {RESISTANCE_FIELDS.slice(3).map(([key, label]) => (
              <div key={key}>
                <span>{label}</span>
                <strong>{Number(((resistances?.[key] ?? 0) * 100).toFixed(2))}%</strong>
              </div>
            ))}
          </div>
        </section>

        <section
          className="dense-panel dense-summary dense-summary--kills"
          aria-label="Recent kill records"
        >
          <header className="dense-panel__header">
            <strong>Recent Kill Records</strong>
          </header>
          <div className="dense-summary__body">{kills}</div>
        </section>
      </div>

      <section className="dense-panel dense-actions" aria-label="Actions">
        {actions}
      </section>

      <section
        className="dense-panel dense-summary dense-summary--statuses"
        aria-label="Conditions and effects"
      >
        <header className="dense-panel__header">
          <strong>Conditions + Effects</strong>
        </header>
        <div className="dense-summary__body">{statuses}</div>
      </section>

      <section
        className="dense-panel dense-summary dense-summary--attributes"
        aria-label="Attributes"
      >
        <header className="dense-panel__header">
          <strong>Attributes</strong>
        </header>
        <div className="dense-summary__body">{attributes}</div>
      </section>

      <section
        className="dense-panel dense-summary dense-summary--proficiencies"
        aria-label="Proficiencies"
      >
        <header className="dense-panel__header">
          <strong>Proficiencies</strong>
        </header>
        <div className="dense-summary__body">{proficiencies}</div>
      </section>

      <section className="dense-panel dense-inventory" aria-label="Inventory">
        {inventory}
      </section>
    </div>
  );
}
