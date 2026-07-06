import { useMemo } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Panel } from "@/shared/ui/Panel";

const ACTION_HISTORY_RENDER_LIMIT = 50;

interface RollLogProps {
  sheetId?: string;
  instanceId?: string;
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function RollLog({ sheetId, instanceId }: RollLogProps = {}): JSX.Element {
  const { state } = useAppStore();
  const isSheetScoped = Boolean(sheetId || instanceId);
  const allEntries = useMemo(
    () =>
      [...state.serverState.actionHistoryOrder]
        .reverse()
        .flatMap((id) => {
          const entry = state.serverState.actionHistory[id];
          return entry ? [entry] : [];
        })
        .filter(
          (entry) =>
            !isSheetScoped ||
            (instanceId ? entry.actor_instance_id === instanceId : entry.actor_sheet_id === sheetId)
        ),
    [
      instanceId,
      isSheetScoped,
      sheetId,
      state.serverState.actionHistory,
      state.serverState.actionHistoryOrder
    ]
  );
  const entries = allEntries.slice(0, ACTION_HISTORY_RENDER_LIMIT);
  const hiddenEntryCount = Math.max(0, allEntries.length - entries.length);

  return (
    <Panel title="Action History">
      {entries.length === 0 ? (
        <EmptyState
          message={
            isSheetScoped ? "No action history for this sheet yet." : "No action history yet."
          }
        />
      ) : (
        <div className="stack">
          {hiddenEntryCount > 0 ? (
            <p className="muted">
              Showing latest {entries.length} of {allEntries.length} entries.
            </p>
          ) : null}
          <div className="action-history-list">
            {entries.map((entry) => (
              <article key={entry.id} className="action-history-entry">
                <div className="action-history-entry__header">
                  <div>
                    <strong>{entry.action_name}</strong>
                    <p>{entry.summary}</p>
                  </div>
                  <span className={`action-history-status action-history-status--${entry.status}`}>
                    {entry.status}
                  </span>
                </div>
                <div className="status-row action-history-entry__meta">
                  <span>
                    Actor:{" "}
                    {state.serverState.sheets[entry.actor_sheet_id]?.name ?? entry.actor_sheet_id}
                    {entry.actor_instance_id ? ` (${entry.actor_instance_id})` : ""} ·{" "}
                    {entry.actor_role === "dm" ? "GM" : "Player"}
                  </span>
                  {entry.target_sheet_id ? (
                    <span>
                      Target:{" "}
                      {state.serverState.persistentSheets[entry.target_sheet_id]
                        ? (state.serverState.sheets[
                            state.serverState.persistentSheets[entry.target_sheet_id].parent_id
                          ]?.name ?? entry.target_sheet_id)
                        : (state.serverState.sheets[entry.target_sheet_id]?.name ??
                          entry.target_sheet_id)}
                    </span>
                  ) : null}
                  <span>{formatCreatedAt(entry.created_at)}</span>
                  <span>v{entry.state_version}</span>
                  {entry.redacted ? <span>Limited</span> : <span>Audit</span>}
                </div>
                {entry.emitted_messages && entry.emitted_messages.length > 0 ? (
                  <div className="action-history-entry__details">
                    <span>Messages</span>
                    <ul>
                      {entry.emitted_messages.map((message, index) => (
                        <li key={`${entry.id}-message-${index}`}>{message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {entry.mutation_summaries && entry.mutation_summaries.length > 0 ? (
                  <div className="action-history-entry__details">
                    <span>Mutations</span>
                    <ul>
                      {entry.mutation_summaries.map((summary, index) => (
                        <li key={`${entry.id}-mutation-${index}`}>{summary}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {entry.formula_summaries && entry.formula_summaries.length > 0 ? (
                  <div className="action-history-entry__details">
                    <span>Formulas</span>
                    <ul>
                      {entry.formula_summaries.map((summary, index) => (
                        <li key={`${entry.id}-formula-${index}`}>{summary}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {entry.error ? <p className="action-history-entry__error">{entry.error}</p> : null}
              </article>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
