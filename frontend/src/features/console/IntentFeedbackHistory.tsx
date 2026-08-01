import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";

function formatFeedbackTime(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

export function IntentFeedbackHistory(): JSX.Element {
  const {
    state: {
      uiState: { intentFeedback }
    },
    dispatch
  } = useAppStore();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasResolvedFeedback = intentFeedback.some((item) => item.status !== "pending");

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="feedback-history" ref={rootRef}>
      <button
        type="button"
        className="system-status feedback-history__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true" />
        History {intentFeedback.length}
      </button>
      {open ? (
        <section className="feedback-history__panel" role="dialog" aria-label="Toast history">
          <header className="feedback-history__header">
            <div>
              <p>Session activity</p>
              <h2>Toast History</h2>
            </div>
            <button
              type="button"
              className="button button--secondary"
              disabled={!hasResolvedFeedback}
              onClick={() => dispatch({ type: "clear_intent_feedback" })}
            >
              Clear All
            </button>
          </header>
          {intentFeedback.length === 0 ? (
            <p className="muted feedback-history__empty">
              Pending, successful, and failed actions will appear here until refresh.
            </p>
          ) : (
            <ol className="feedback-history__list">
              {intentFeedback.map((item) => (
                <li
                  key={item.id}
                  className={`feedback-history__item feedback-history__item--${item.status}`}
                >
                  <div className="feedback-history__item-heading">
                    <strong>{item.status}</strong>
                    <time dateTime={item.createdAt}>{formatFeedbackTime(item.createdAt)}</time>
                    {item.status === "pending" ? (
                      <span className="feedback-history__pending-mark">Active</span>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Remove ${item.status} history entry`}
                        onClick={() => dispatch({ type: "dismiss_intent_feedback", id: item.id })}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <p>{item.message}</p>
                  {item.intentId ? <code>Request: {item.intentId}</code> : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </div>
  );
}
