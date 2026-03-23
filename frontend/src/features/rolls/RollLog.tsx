import { useAppStore } from "@/app/state/store";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Panel } from "@/shared/ui/Panel";

export function RollLog({
  sheetId
}: {
  sheetId?: string | null;
} = {}): JSX.Element {
  const {
    state: { rollLog, role }
  } = useAppStore();
  const entries = sheetId ? rollLog.filter((entry) => entry.request.sheetId === sheetId) : rollLog;

  return (
    <Panel title="Roll Log">
      <div className="list">
        {entries.length === 0 ? <EmptyState message="No rolls yet." /> : null}
        {entries.map((entry) => {
          const isHiddenToPlayer = role === "player" && entry.request.visibility === "hidden";
          const title =
            entry.request.kind === "dice"
              ? `${entry.request.count}d${entry.request.sides} roll`
              : `${entry.request.stat} check`;
          return (
            <article key={entry.id} className="list-item list-item--block">
              <div className="list-item__top">
                <strong>{isHiddenToPlayer ? "Hidden GM Roll" : title}</strong>
                <span className={`pill pill--${entry.status}`}>{entry.status}</span>
              </div>
              <div className="muted">{new Date(entry.createdAt).toLocaleString()}</div>
              {!isHiddenToPlayer ? (
                <>
                  <div>{entry.resultText ?? entry.error ?? "Awaiting result..."}</div>
                </>
              ) : null}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
