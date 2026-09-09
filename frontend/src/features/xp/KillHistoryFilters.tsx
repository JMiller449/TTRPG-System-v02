import { useId } from "react";
import type { XpTrackerKillEvent } from "@/generated/backendProtocol";
import { Field } from "@/shared/ui/Field";
import {
  emptyKillFilters,
  hasInvalidKillDateRange,
  killFilterOptions,
  type KillFilters
} from "./killFilters";

export function KillHistoryFilters({
  kills,
  filters,
  onChange,
  matchingCount
}: {
  kills: readonly XpTrackerKillEvent[];
  filters: KillFilters;
  onChange: (filters: KillFilters) => void;
  matchingCount: number;
}): JSX.Element {
  const options = killFilterOptions(kills);
  const errorId = useId();
  const invalidDates = hasInvalidKillDateRange(filters);
  const activeCount = Object.values(filters).filter((value) => value.trim()).length;

  return (
    <div className="xp-kill-filters" role="group" aria-label="Kill history filters">
      <input
        type="search"
        aria-label="Filter kill registry"
        placeholder="Search enemy, character, or notes"
        value={filters.search}
        onChange={(event) => onChange({ ...filters, search: event.target.value })}
      />
      <details className="xp-kill-filters__details">
        <summary>Filters{activeCount > 0 ? ` (${activeCount})` : ""}</summary>
        <div className="xp-kill-filters__fields">
          <Field label="Participating player">
            <select
              aria-label="Participating player"
              value={filters.participantId}
              onChange={(event) => onChange({ ...filters, participantId: event.target.value })}
            >
              <option value="">All participants</option>
              {filters.participantId &&
              !options.participants.some((option) => option.value === filters.participantId) ? (
                <option value={filters.participantId}>Selected player (no records)</option>
              ) : null}
              {options.participants.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Enemy type">
            <select
              aria-label="Enemy type"
              value={filters.enemyKey}
              onChange={(event) => onChange({ ...filters, enemyKey: event.target.value })}
            >
              <option value="">All enemy types</option>
              {filters.enemyKey &&
              !options.enemies.some((option) => option.value === filters.enemyKey) ? (
                <option value={filters.enemyKey}>Selected enemy (no records)</option>
              ) : null}
              {options.enemies.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From date" invalid={invalidDates}>
            <input
              type="date"
              value={filters.fromDate}
              max={filters.toDate || undefined}
              aria-invalid={invalidDates}
              aria-describedby={invalidDates ? errorId : undefined}
              onChange={(event) => onChange({ ...filters, fromDate: event.target.value })}
            />
          </Field>
          <Field label="Through date" invalid={invalidDates}>
            <input
              type="date"
              value={filters.toDate}
              min={filters.fromDate || undefined}
              aria-invalid={invalidDates}
              aria-describedby={invalidDates ? errorId : undefined}
              onChange={(event) => onChange({ ...filters, toDate: event.target.value })}
            />
          </Field>
          <small>Dates include the full day in your local timezone.</small>
        </div>
      </details>
      {invalidDates ? (
        <p id={errorId} role="alert">
          From date must be on or before through date.
        </p>
      ) : null}
      <div className="xp-kill-filters__status">
        <span role="status">
          {activeCount > 0
            ? `${matchingCount} of ${kills.length} records`
            : `${kills.length} record${kills.length === 1 ? "" : "s"}`}
        </span>
        {activeCount > 0 ? (
          <button
            className="button button--secondary"
            type="button"
            onClick={() => onChange({ ...emptyKillFilters })}
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
