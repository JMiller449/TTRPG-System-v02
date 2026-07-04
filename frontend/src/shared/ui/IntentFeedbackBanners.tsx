import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { IntentFeedbackItem } from "@/app/state/types";
import { shouldDisplayIntentFeedback } from "@/shared/ui/intentFeedbackVisibility";

const INTENT_BANNER_TTL_MS = {
  pending: 4000,
  success: 3500
} as const;

function dedupeFeedback(items: IntentFeedbackItem[]): IntentFeedbackItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.status}:${item.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function IntentFeedbackBanners(): JSX.Element | null {
  const {
    state: {
      uiState: { connection, intentFeedback, roll20Bridge }
    },
    dispatch
  } = useAppStore();
  const [dismissedSystemIds, setDismissedSystemIds] = useState<string[]>([]);
  const timeoutIdsRef = useRef<Record<string, number>>({});
  const systemFeedback = useMemo<IntentFeedbackItem[]>(() => {
    const items: IntentFeedbackItem[] = [];
    if (connection.error) {
      items.push({
        id: `system-connection:${connection.error}`,
        status: "error",
        message: connection.error,
        createdAt: new Date().toISOString()
      });
    }
    if (roll20Bridge.lastError) {
      items.push({
        id: `system-roll20:${roll20Bridge.lastError}`,
        status: "error",
        message: roll20Bridge.lastError,
        createdAt: roll20Bridge.lastCheckedAt ?? new Date().toISOString()
      });
    }
    return items.filter((item) => !dismissedSystemIds.includes(item.id));
  }, [connection.error, dismissedSystemIds, roll20Bridge.lastCheckedAt, roll20Bridge.lastError]);
  const visibleFeedback = dedupeFeedback([
    ...intentFeedback.filter(shouldDisplayIntentFeedback),
    ...systemFeedback
  ]);

  useEffect(() => {
    const activeIds = new Set(intentFeedback.map((item) => item.id));

    intentFeedback.forEach((item) => {
      if (item.status === "error") {
        return;
      }
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

  useEffect(() => {
    setDismissedSystemIds((current) =>
      current.filter((id) =>
        id.startsWith("system-connection:")
          ? id === `system-connection:${connection.error}`
          : id.startsWith("system-roll20:")
            ? id === `system-roll20:${roll20Bridge.lastError}`
            : true
      )
    );
  }, [connection.error, roll20Bridge.lastError]);

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
    <section className="intent-banner-stack" aria-live="polite" aria-label="System messages">
      {visibleFeedback.map((item) => (
        <article key={item.id} className={`intent-banner intent-banner--${item.status}`}>
          <div>
            <strong className="intent-banner__status">{item.status}</strong>{" "}
            <span className="intent-banner__message" title={item.message}>
              {item.message}
            </span>
          </div>
          <button
            className="link-button"
            onClick={() => {
              if (item.id.startsWith("system-")) {
                setDismissedSystemIds((current) =>
                  current.includes(item.id) ? current : [...current, item.id]
                );
                return;
              }
              dispatch({ type: "dismiss_intent_feedback", id: item.id });
            }}
          >
            Dismiss
          </button>
        </article>
      ))}
    </section>
  );
}
