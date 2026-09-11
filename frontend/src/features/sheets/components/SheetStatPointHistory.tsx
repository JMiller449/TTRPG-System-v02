import { useEffect, useState } from "react";
import type { StatPointEntry, StatPointSummary } from "@/generated/backendProtocol";
import type { GameClient } from "@/hooks/useGameClient";
import { useAppStore } from "@/app/state/useAppStore";
import {
  buildSetInstancedSheetBaseStatRequest,
  buildSetInstancedSheetUnassignedStatPointsRequest
} from "@/infrastructure/ws/requestBuilders";
import { makeId } from "@/shared/utils/id";
import { Field } from "@/shared/ui/Field";

const sources = [
  ["starting", "Starting / Spawned"],
  ["level_up", "Level-Up"],
  ["manual", "Manually Granted"],
  ["legacy_unknown", "Legacy / Unknown"]
] as const;
const skills = ["strength", "dexterity", "constitution", "perception", "arcane", "will"] as const;
type Target = "unspent" | (typeof skills)[number];
const title = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);
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
              <strong>
                {entry.skill ? title(entry.skill) : "Unspent points"}: {signed(entry.amount)}
              </strong>
              <p>
                {entry.character_name} ({entry.instance_id}) · {title(entry.kind)}
              </p>
              <p>
                {entry.previous_value} → {entry.resulting_value} · Unspent: {entry.previous_unspent}{" "}
                → {entry.resulting_unspent}
              </p>
              <p>{sourceText(entry.changes[entry.skill ?? "unspent"])}</p>
              <p>
                <time dateTime={entry.occurred_at}>
                  {new Date(entry.occurred_at).toLocaleString()}
                </time>{" "}
                · {entry.actor_role}
                {entry.actor_instance_id ? ` (${entry.actor_instance_id})` : ""}
              </p>
              {entry.reason ? <p>{entry.reason}</p> : null}
            </article>
          ))}
        {!visible.length ? <p>No matching changes.</p> : null}
      </div>
    </details>
  );
}

export function StatPointSummaryView({ summary }: { summary: StatPointSummary }): JSX.Element {
  return (
    <>
      <p>
        <strong>{summary.unspent ?? 0} unspent points</strong> ·{" "}
        {summary.reconciles ? "Balances reconcile" : "Balances need DM review"}
      </p>
      {summary.has_legacy_baseline ? (
        <p>
          Legacy values have unknown origins. Their original grants and allocation dates cannot be
          reconstructed.
        </p>
      ) : null}
      <p className="stat-point-history__scroll-hint">Scroll tables sideways to see all columns.</p>
      <div
        className="stat-point-history__table"
        tabIndex={0}
        aria-label="Point source and allocation tables"
      >
        <table>
          <caption>Points by source</caption>
          <thead>
            <tr>
              <th>Source</th>
              <th>Earned</th>
              <th>Removed / reversed</th>
              <th>Unspent</th>
            </tr>
          </thead>
          <tbody>
            {sources.map(([key, label]) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                <td>{summary.earned?.[key] ?? 0}</td>
                <td>{summary.removed?.[key] ?? 0}</td>
                <td>{summary.unspent_sources?.[key] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table>
          <caption>Points in each core skill / stat</caption>
          <thead>
            <tr>
              <th>Skill</th>
              <th>Current base</th>
              <th>Player assigned (net)</th>
              <th>Sources</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((skill) => (
              <tr key={skill}>
                <th scope="row">{title(skill)}</th>
                <td>{summary.allocated?.[skill] ?? 0}</td>
                <td>{summary.player_allocations?.[skill] ?? 0}</td>
                <td>{sourceText(summary.allocation_sources?.[skill])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Allocation attribution uses starting points, then level-up, manual, and legacy points. Base
        values include spawned stats and direct DM assignments; temporary modifiers are excluded.
        Player assigned shows allocation history after refunds.
      </p>
    </>
  );
}

function StatPointAdjustment({
  instanceId,
  summary,
  client
}: {
  instanceId: string;
  summary: StatPointSummary;
  client: GameClient;
}): JSX.Element {
  const {
    state: {
      uiState: { intentFeedback }
    }
  } = useAppStore();
  const [target, setTarget] = useState<Target>("unspent");
  const [source, setSource] = useState<"manual" | "level_up">("manual");
  const current =
    target === "unspent" ? (summary.unspent ?? 0) : (summary.allocated?.[target] ?? 0);
  const [value, setValue] = useState(String(current));
  const [reason, setReason] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const feedback = intentFeedback.find((entry) => entry.intentId === pendingId);
  const pending = pendingId !== null && (!feedback || feedback.status === "pending");
  useEffect(() => {
    setValue(String(current));
  }, [current, target]);
  const parsed = Number(value);
  const valid =
    value.trim() !== "" &&
    Number.isSafeInteger(parsed) &&
    (target !== "unspent" || parsed >= 0) &&
    parsed !== current;
  return (
    <form
      className="stat-point-history__adjustment"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid || pending) return;
        const requestId = makeId("stat-points");
        const fields = { instanceId, value: parsed, pointSource: source, reason, requestId };
        const request =
          target === "unspent"
            ? buildSetInstancedSheetUnassignedStatPointsRequest(fields)
            : buildSetInstancedSheetBaseStatRequest({ ...fields, statName: target });
        setPendingId(requestId);
        client.sendProtocolRequest(request, "Update stat points");
      }}
    >
      <h4>DM point adjustment</h4>
      <p>
        Set the resulting balance. Increases are recorded under the selected source; decreases
        retain the removed points’ origins. Level-up awards are explicit and do not change Level.
      </p>
      <div className="inline-actions">
        <Field label="Point destination">
          <select
            value={target}
            disabled={pending}
            onChange={(event) => setTarget(event.target.value as Target)}
          >
            <option value="unspent">Unspent pool</option>
            {skills.map((skill) => (
              <option key={skill} value={skill}>
                {title(skill)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Award source">
          <select
            value={source}
            onChange={(event) => setSource(event.target.value as "manual" | "level_up")}
          >
            <option value="manual">Manual grant / correction</option>
            <option value="level_up">Level-up award</option>
          </select>
        </Field>
        <Field label={`Resulting value (currently ${current})`}>
          <input
            type="number"
            step="1"
            min={target === "unspent" ? 0 : undefined}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        <Field label="Audit note">
          <input
            value={reason}
            maxLength={1000}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <button className="button" type="submit" disabled={!valid || pending}>
          {pending ? "Saving…" : "Set points"}
        </button>
      </div>
      {feedback?.status === "error" ? <p role="alert">{feedback.message}</p> : null}
    </form>
  );
}

export function SheetStatPointHistory({
  instanceId,
  summary,
  audit,
  canManage,
  client
}: {
  instanceId: string;
  summary?: StatPointSummary | null;
  audit?: StatPointEntry[] | null;
  canManage: boolean;
  client: GameClient;
}): JSX.Element {
  return (
    <details className="character-sheet__utility stat-point-history">
      <summary className="character-sheet__utility-summary">
        <span>Skill Point Provenance</span>
        <span>{summary?.unspent ?? 0} unspent</span>
      </summary>
      <div className="character-sheet__utility-body">
        {summary ? (
          <StatPointSummaryView summary={summary} />
        ) : (
          <p>Point history is not available yet.</p>
        )}
        {canManage && summary ? (
          <StatPointAdjustment
            key={`adjustment:${instanceId}`}
            instanceId={instanceId}
            summary={summary}
            client={client}
          />
        ) : null}
        {canManage ? <StatPointAudit key={`audit:${instanceId}`} entries={audit ?? []} /> : null}
      </div>
    </details>
  );
}
