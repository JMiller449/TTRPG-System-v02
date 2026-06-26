import { useMemo } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Panel } from "@/shared/ui/Panel";

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

export function RollLog(): JSX.Element {
  const { state } = useAppStore();
  const entries = useMemo(
    () =>
      [...state.serverState.actionHistoryOrder]
        .reverse()
        .flatMap((id) => {
          const entry = state.serverState.actionHistory[id];
          return entry ? [entry] : [];
        }),
    [state.serverState.actionHistory, state.serverState.actionHistoryOrder]
  );

  return (
    <Panel title="Action History">
      {entries.length === 0 ? (
        <EmptyState message="No action history yet." />
      ) : (
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
      )}
    </Panel>
  );
}
