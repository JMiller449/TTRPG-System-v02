import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "@/app/state/useAppStore";

interface HistoryPanelPosition {
  left: number;
  top: number;
}

function historyPanelPosition(trigger: DOMRect): HistoryPanelPosition {
  const viewportMargin = 10;
  const panelWidth = Math.min(440, window.innerWidth - viewportMargin * 2);
  return {
    left: Math.min(
      Math.max(viewportMargin, trigger.right - panelWidth),
      window.innerWidth - panelWidth - viewportMargin
    ),
    top: trigger.bottom + 9
  };
}

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [panelPosition, setPanelPosition] = useState<HistoryPanelPosition | null>(null);
  const hasResolvedFeedback = intentFeedback.some((item) => item.status !== "pending");

  useEffect(() => {
    if (!open) {
      return;
    }
    const updatePosition = (): void => {
      const trigger = triggerRef.current;
      if (trigger) {
        setPanelPosition(historyPanelPosition(trigger.getBoundingClientRect()));
      }
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    updatePosition();
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <div className="feedback-history" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="system-status feedback-history__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true" />
        History {intentFeedback.length}
      </button>
      {open && panelPosition
        ? createPortal(
            <section
              ref={panelRef}
              className="feedback-history__panel"
              role="dialog"
              aria-label="Toast history"
              style={panelPosition}
            >
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
                            onClick={() =>
                              dispatch({ type: "dismiss_intent_feedback", id: item.id })
                            }
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
            </section>,
            document.body
          )
        : null}
    </div>
  );
}
