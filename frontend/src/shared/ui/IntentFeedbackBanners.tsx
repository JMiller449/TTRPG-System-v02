import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { IntentFeedbackItem } from "@/app/state/types";

const INTENT_TOAST_TTL_MS: Record<Exclude<IntentFeedbackItem["status"], "pending">, number> = {
  success: 4000,
  error: 8000
};

const MAX_VISIBLE_TOASTS = 4;

export function IntentFeedbackToasts(): JSX.Element | null {
  const {
    state: {
      uiState: { intentFeedback }
    }
  } = useAppStore();
  const [dismissedToastIds, setDismissedToastIds] = useState<string[]>([]);
  const timeoutIdsRef = useRef<Record<string, number>>({});
  const visibleFeedback = intentFeedback
    .filter((item) => !dismissedToastIds.includes(item.id))
    .slice(0, MAX_VISIBLE_TOASTS);

  const dismissToast = (id: string): void => {
    const timeoutId = timeoutIdsRef.current[id];
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      delete timeoutIdsRef.current[id];
    }
    setDismissedToastIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  useEffect(() => {
    const activeIds = new Set(intentFeedback.map((item) => item.id));

    intentFeedback.forEach((item) => {
      if (
        item.status === "pending" ||
        dismissedToastIds.includes(item.id) ||
        timeoutIdsRef.current[item.id]
      ) {
        return;
      }
      timeoutIdsRef.current[item.id] = window.setTimeout(() => {
        delete timeoutIdsRef.current[item.id];
        setDismissedToastIds((current) =>
          current.includes(item.id) ? current : [...current, item.id]
        );
      }, INTENT_TOAST_TTL_MS[item.status]);
    });

    Object.entries(timeoutIdsRef.current).forEach(([id, timeoutId]) => {
      if (activeIds.has(id) && !dismissedToastIds.includes(id)) {
        return;
      }
      window.clearTimeout(timeoutId);
      delete timeoutIdsRef.current[id];
    });
  }, [dismissedToastIds, intentFeedback]);

  useEffect(
    () => () => {
      Object.values(timeoutIdsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeoutIdsRef.current = {};
    },
    []
  );

  if (visibleFeedback.length === 0) {
    return null;
  }

  return (
    <section className="intent-toast-stack" aria-live="polite" aria-label="Recent notifications">
      {visibleFeedback.map((item) => (
        <article
          key={item.id}
          className={`intent-toast intent-toast--${item.status}`}
          role={item.status === "error" ? "alert" : "status"}
        >
          <div className="intent-toast__content">
            <strong className="intent-toast__status">{item.status}</strong>
            <p className="intent-toast__message">{item.message}</p>
          </div>
          <button
            type="button"
            className="intent-toast__dismiss"
            aria-label={`Dismiss ${item.status} notification`}
            onClick={() => dismissToast(item.id)}
          >
            ×
          </button>
        </article>
      ))}
    </section>
  );
}
