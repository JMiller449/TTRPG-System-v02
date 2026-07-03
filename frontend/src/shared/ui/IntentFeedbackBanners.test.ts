import { describe, expect, it } from "vitest";
import type { IntentFeedbackItem } from "@/app/state/types";
import { shouldDisplayIntentFeedback } from "@/shared/ui/intentFeedbackVisibility";

function feedback(
  message: string,
  status: IntentFeedbackItem["status"] = "success"
): IntentFeedbackItem {
  return {
    id: "feedback-1",
    status,
    message,
    createdAt: "2026-07-03T00:00:00Z"
  };
}

describe("IntentFeedbackBanners", () => {
  it("suppresses non-actionable load and refresh progress", () => {
    expect(
      shouldDisplayIntentFeedback(feedback("Load condition augmentation targets synced."))
    ).toBe(false);
    expect(shouldDisplayIntentFeedback(feedback("Refresh XP tracker pending...", "pending"))).toBe(
      false
    );
  });

  it("keeps mutations and read failures visible", () => {
    expect(shouldDisplayIntentFeedback(feedback("Create condition: Poisoned synced."))).toBe(true);
    expect(
      shouldDisplayIntentFeedback(
        feedback("Load condition augmentation targets rejected: unavailable", "error")
      )
    ).toBe(true);
  });
});
