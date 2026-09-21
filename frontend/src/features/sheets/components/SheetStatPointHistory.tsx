import { useState } from "react";
import type { StatPointEntry, StatPointSummary } from "@/generated/backendProtocol";
import { Field } from "@/shared/ui/Field";

const sources = [
  ["starting", "Starter / Spawned"],
  ["level_up", "Level-Up"],
  ["manual", "Manually Granted"],
  ["legacy_unknown", "Legacy / Unknown"]
] as const;
const skills = ["strength", "dexterity", "constitution", "perception", "arcane", "will"] as const;
const title = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);
const kindLabel = (value: string): string =>
  value === "unassigned_grant" ? "Gave unassigned points" : title(value);
const signed = (value: number): string => `${value > 0 ? "+" : ""}${value}`;

function sourceText(parts: Record<string, number> = {}): string {
  return (
    sources
      .filter(([key]) => parts[key])
      .map(([key, label]) => `${label}: ${parts[key]}`)
      .join(" · ") || "—"
  );
}

export function StatPointAudit({ entries }: { entries: StatPointEntry[] }): JSX.Element {
  const [filter, setFilter] = useState("");
  const visible = entries.filter((entry) => !filter || entry.skill === filter);
  return (
    <details>
      <summary>DM audit history ({entries.length})</summary>
      <Field label="Filter history by skill">
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">All changes</option>
          {skills.map((skill) => (
            <option key={skill} value={skill}>
              {title(skill)}
            </option>
          ))}
        </select>
      </Field>
      <div className="stat-point-history__audit" tabIndex={0} aria-label="Stat point audit records">
        {visible
          .slice()
          .reverse()
          .map((entry) => (
            <article key={entry.id} className="stat-point-history__entry">
              <header>
                <div>
                  <strong>{entry.skill ? title(entry.skill) : "Unspent points"}</strong>
                  <span>{kindLabel(entry.kind)}</span>
                </div>
                <b className={entry.amount < 0 ? "is-negative" : "is-positive"}>
                  {signed(entry.amount)}
                </b>
              </header>
              <p className="stat-point-history__entry-character">
                {entry.character_name} <span>{entry.instance_id}</span>
              </p>
              <div className="stat-point-history__entry-values">
                <span>
                  Value: {entry.previous_value} → {entry.resulting_value}
                </span>
                <span>
                  Unspent: {entry.previous_unspent} → {entry.resulting_unspent}
                </span>
              </div>
              <p className="stat-point-history__entry-sources">
                {sourceText(entry.changes[entry.skill ?? "unspent"])}
              </p>
              <footer>
                <time dateTime={entry.occurred_at}>
                  {new Date(entry.occurred_at).toLocaleString()}
                </time>{" "}
                · {entry.actor_role}
                {entry.actor_instance_id ? ` (${entry.actor_instance_id})` : ""}
              </footer>
              {entry.reason ? (
                <p className="stat-point-history__entry-reason">{entry.reason}</p>
              ) : null}
            </article>
          ))}
        {!visible.length ? <p>No matching changes.</p> : null}
      </div>
    </details>
  );
}

export function StatPointSummaryView({ summary }: { summary: StatPointSummary }): JSX.Element {
  const visibleSources = sources.filter(
    ([key]) =>
      key !== "legacy_unknown" ||
      Boolean(summary.earned?.[key] || summary.removed?.[key] || summary.unspent_sources?.[key])
  );
  return (
    <>
      <div className="stat-point-history__status">
        <div className="stat-point-history__available">
          <span>Available to assign</span>
          <strong>{summary.unspent ?? 0} unspent points</strong>
        </div>
        <span
          className={`stat-point-history__balance ${
            summary.reconciles
              ? "stat-point-history__balance--reconciled"
              : "stat-point-history__balance--review"
          }`}
        >
          {summary.reconciles ? "Balances reconcile" : "Balances need DM review"}
        </span>
      </div>
      {summary.has_legacy_baseline ? (
        <p className="stat-point-history__warning">
          Legacy values have unknown origins. Their original grants and allocation dates cannot be
          reconstructed.
        </p>
      ) : null}
      <section className="stat-point-history__section" aria-labelledby="point-source-heading">
        <h4 id="point-source-heading">Point sources</h4>
        <div className="stat-point-history__source-grid">
          {visibleSources.map(([key, label]) => (
            <article key={key} className="stat-point-history__source-card">
              <strong>{label}</strong>
              <dl>
                <div>
                  <dt>Earned</dt>
                  <dd>{summary.earned?.[key] ?? 0}</dd>
                </div>
                <div>
                  <dt>Reversed</dt>
                  <dd>{summary.removed?.[key] ?? 0}</dd>
                </div>
                <div>
                  <dt>Unspent</dt>
                  <dd>{summary.unspent_sources?.[key] ?? 0}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
      <section className="stat-point-history__section" aria-labelledby="stat-assignment-heading">
        <h4 id="stat-assignment-heading">Core stat assignment</h4>
        <div className="stat-point-history__stat-grid">
          {skills.map((skill) => (
            <article key={skill} className="stat-point-history__stat-card">
              <header>
                <strong>{title(skill)}</strong>
                <span>
                  Base <b>{summary.allocated?.[skill] ?? 0}</b>
                </span>
              </header>
              <dl>
                <div>
                  <dt>Starter</dt>
                  <dd>{summary.assignment_origins?.[skill]?.starter ?? 0}</dd>
                </div>
                <div>
                  <dt>User</dt>
                  <dd>{summary.assignment_origins?.[skill]?.user ?? 0}</dd>
                </div>
                <div>
                  <dt>DM</dt>
                  <dd>{summary.assignment_origins?.[skill]?.dm ?? 0}</dd>
                </div>
              </dl>
              <p title={sourceText(summary.allocation_sources?.[skill])}>
                {sourceText(summary.allocation_sources?.[skill])}
              </p>
            </article>
          ))}
        </div>
      </section>
      <p className="stat-point-history__note">
        Imported pre-ledger values count as Starter points. User assigned is the player’s net
        allocation from the unspent pool; DM assigned is the remaining direct adjustment. Temporary
        augmentations are excluded from these base values.
      </p>
    </>
  );
}

export function SheetStatPointHistory({
  instanceId,
  summary,
  audit,
  canManage,
  onGrantUnspent
}: {
  instanceId: string;
  summary?: StatPointSummary | null;
  audit?: StatPointEntry[] | null;
  canManage: boolean;
  onGrantUnspent?: () => void;
}): JSX.Element {
  return (
    <details className="character-sheet__utility stat-point-history">
      <summary className="character-sheet__utility-summary">
        <span>Skill Point Provenance</span>
        <span className="character-sheet__utility-value">{summary?.unspent ?? 0} unspent</span>
      </summary>
      <div className="character-sheet__utility-body">
        {summary ? (
          <StatPointSummaryView summary={summary} />
        ) : (
          <p>Point history is not available yet.</p>
        )}
        {canManage ? (
          <div className="stat-point-history__management">
            {onGrantUnspent ? (
              <button className="button button--secondary" type="button" onClick={onGrantUnspent}>
                Grant Unspent Points
              </button>
            ) : null}
            <StatPointAudit key={`audit:${instanceId}`} entries={audit ?? []} />
          </div>
        ) : null}
      </div>
    </details>
  );
}
