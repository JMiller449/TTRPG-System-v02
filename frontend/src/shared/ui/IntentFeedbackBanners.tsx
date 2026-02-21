import { useAppStore } from "@/app/state/store";

export function IntentFeedbackBanners(): JSX.Element | null {
  const {
    state: { intentFeedback },
    dispatch
  } = useAppStore();

  if (intentFeedback.length === 0) {
    return null;
  }

  return (
    <section className="intent-banner-stack" aria-live="polite">
      {intentFeedback.map((item) => (
        <article key={item.id} className={`intent-banner intent-banner--${item.status}`}>
          <div>
            <strong className="intent-banner__status">{item.status}</strong>
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
