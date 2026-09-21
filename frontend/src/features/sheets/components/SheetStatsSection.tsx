import type { StatPointSummary } from "@/generated/backendProtocol";
import type { Augmentation, Formula } from "@/domain/models";
import { formatAugmentationEffect } from "@/features/augmentations/augmentationEditorValues";
import {
  CORE_SUBSTAT_GROUPS,
  DISPLAY_NAMES,
  isResourceKey,
  type SheetStatKey
} from "@/features/sheets/sheetDisplay";
import type { SheetFormulaStatName } from "@/features/sheets/sheetDefinitionEditing";

export function SheetStatsSection({
  canEditStats,
  compact = false,
  stats,
  formulaStats,
  statPointSummary,
  augmentations = {},
  instanceId,
  onAddCoreStatPoints,
  onEditFormulaStat
}: {
  canEditStats: boolean;
  compact?: boolean;
  stats: Partial<Record<SheetStatKey, number>>;
  formulaStats?: Partial<Record<SheetFormulaStatName, Formula>>;
  statPointSummary?: StatPointSummary | null;
  augmentations?: Record<string, Augmentation>;
  instanceId?: string;
  onAddCoreStatPoints: (key: SheetStatKey) => void;
  onEditFormulaStat?: (statName: SheetFormulaStatName) => void;
}): JSX.Element {
  return (
    <section
      className={`character-sheet__section ${compact ? "character-sheet__section--compact" : ""}`}
    >
      <h4>{compact ? "Stats" : "Core Stats and Related Substats"}</h4>
      {!compact ? (
        <p className="muted character-sheet__hint">
          {canEditStats
            ? "Hover over a core stat for its assignment and augmentation breakdown, or click it to change its value. Derived stats expose their formulas the same way."
            : "Hover over or focus a core stat for its assignment and augmentation breakdown."}
        </p>
      ) : null}
      <div className="character-sheet__core-blocks">
        {CORE_SUBSTAT_GROUPS.map((group) => {
          const key = group.core;
          const baseValue = stats[key] ?? 0;
          const currentValue = baseValue;
          const assignedBase = statPointSummary?.allocated?.[key] ?? baseValue;
          const assignment = statPointSummary?.assignment_origins?.[key];
          const activeAugmentations = Object.values(augmentations).filter(
            (augmentation) =>
              augmentation.active !== false &&
              augmentation.applied === true &&
              augmentation.applied_target_id === instanceId &&
              augmentation.effect.type === "formula_modifier" &&
              augmentation.target.root === "instance" &&
              augmentation.target.path.length === 2 &&
              augmentation.target.path[0] === "stats" &&
              augmentation.target.path[1] === key
          );
          const breakdownId = `core-stat-breakdown-${key}`;
          return (
            <section key={key} className="core-block">
              <header className="core-block__header">
                <div
                  className="core-block__summary"
                  tabIndex={canEditStats ? undefined : 0}
                  aria-describedby={canEditStats ? undefined : breakdownId}
                >
                  <div>
                    <span className="core-block__label">{DISPLAY_NAMES[key]}</span>
                  </div>
                  <div className="core-block__value-wrap">
                    {canEditStats ? (
                      <button
                        type="button"
                        className="core-block__value-button"
                        onClick={() => onAddCoreStatPoints(key)}
                        aria-label={`Add points to ${DISPLAY_NAMES[key]}. Current value ${currentValue}.`}
                        aria-describedby={breakdownId}
                      >
                        <strong className="core-block__value">{currentValue}</strong>
                      </button>
                    ) : (
                      <strong className="core-block__value">{currentValue}</strong>
                    )}
                  </div>
                  <span
                    className="formula-stat-tooltip core-stat-tooltip"
                    id={breakdownId}
                    role="tooltip"
                  >
                    <strong>Effective: {currentValue}</strong>
                    <span>Base total: {assignedBase}</span>
                    <span>Starter: {assignment?.starter ?? assignedBase}</span>
                    <span>User assigned: {assignment?.user ?? 0}</span>
                    <span>DM assigned: {assignment?.dm ?? 0}</span>
                    {activeAugmentations.length > 0 ? (
                      <span className="core-stat-tooltip__augmentations">
                        <strong>Augmentations</strong>
                        {activeAugmentations.map((augmentation) => (
                          <span key={augmentation.id}>
                            {augmentation.name}: {formatAugmentationEffect(augmentation)}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span>No active augmentations</span>
                    )}
                  </span>
                </div>
              </header>

              <div className="core-block__subs">
                {group.subs.map((subKey) => {
                  const subBase = stats[subKey];
                  const displaySubBase = subBase ?? "—";
                  const formula = formulaStats?.[subKey];
                  const tooltipId = `formula-tooltip-${subKey}`;
                  const aliases = formula?.aliases ?? [];
                  const aliasSummary =
                    aliases.length > 0
                      ? aliases
                          .map((alias) => `@${alias.name} → ${alias.path.join(".")}`)
                          .join(", ")
                      : "No aliases configured";
                  const formulaContent = formula ? (
                    <span className="formula-stat-tooltip" id={tooltipId} role="tooltip">
                      <span>
                        Formula: <code>{formula.text}</code>
                      </span>
                      <span>{aliasSummary}</span>
                    </span>
                  ) : null;
                  const canEditFormula = canEditStats && Boolean(formula) && onEditFormulaStat;
                  return (
                    <div
                      key={subKey}
                      className={`core-sub-row ${isResourceKey(subKey) ? "core-sub-row--base-only" : ""}`}
                    >
                      <div className="core-sub-row__top">
                        {canEditFormula ? (
                          <button
                            type="button"
                            className="core-sub-row__main core-sub-row__main--formula"
                            onClick={() => onEditFormulaStat(subKey)}
                            aria-label={`Edit ${DISPLAY_NAMES[subKey]} formula. Current value ${displaySubBase}.`}
                            aria-describedby={tooltipId}
                          >
                            <span className="core-sub-row__label">{DISPLAY_NAMES[subKey]}</span>
                            <span className="core-sub-row__value">{displaySubBase}</span>
                            {formulaContent}
                          </button>
                        ) : (
                          <div
                            className={`core-sub-row__main core-sub-row__main--static ${formula ? "core-sub-row__main--formula" : ""}`}
                            tabIndex={formula ? 0 : undefined}
                            aria-describedby={formula ? tooltipId : undefined}
                          >
                            <span className="core-sub-row__label">{DISPLAY_NAMES[subKey]}</span>
                            <span className="core-sub-row__value">{displaySubBase}</span>
                            {formulaContent}
                          </div>
                        )}
                        <div className="core-sub-row__actions core-sub-row__actions--placeholder" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
