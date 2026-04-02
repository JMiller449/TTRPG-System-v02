import { useEffect, useRef } from "react";
import { useAppStore } from "@/app/state/store";

const INTENT_BANNER_TTL_MS = {
  pending: 4000,
  success: 3500,
  error: 6000
} as const;

export function IntentFeedbackBanners(): JSX.Element | null {
  const {
    state: {
      uiState: { intentFeedback }
    },
    dispatch
  } = useAppStore();
  const timeoutIdsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const activeIds = new Set(intentFeedback.map((item) => item.id));

    intentFeedback.forEach((item) => {
      if (timeoutIdsRef.current[item.id]) {
        return;
      }

      timeoutIdsRef.current[item.id] = window.setTimeout(() => {
        delete timeoutIdsRef.current[item.id];
        dispatch({ type: "dismiss_intent_feedback", id: item.id });
      }, INTENT_BANNER_TTL_MS[item.status]);
    });

    Object.entries(timeoutIdsRef.current).forEach(([id, timeoutId]) => {
      if (activeIds.has(id)) {
        return;
      }
      window.clearTimeout(timeoutId);
      delete timeoutIdsRef.current[id];
    });
  }, [dispatch, intentFeedback]);

  useEffect(
    () => () => {
      Object.values(timeoutIdsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      timeoutIdsRef.current = {};
    },
    []
  );

  if (intentFeedback.length === 0) {
    return null;
  }

  return (
    <section className="intent-banner-stack" aria-live="polite">
      {intentFeedback.map((item) => (
        <article key={item.id} className={`intent-banner intent-banner--${item.status}`}>
          <div>
            <strong className="intent-banner__status">{item.status}</strong>
            {" "}
            <span className="intent-banner__message">{item.message}</span>
          </div>
          <button
            className="link-button"
            onClick={() => dispatch({ type: "dismiss_intent_feedback", id: item.id })}
          >
            Dismiss
          </button>
        </article>
      ))}
    </section>
  );
}
