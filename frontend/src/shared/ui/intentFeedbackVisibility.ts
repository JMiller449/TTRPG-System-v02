import type { IntentFeedbackItem } from "@/app/state/types";

export function shouldDisplayIntentFeedback(item: IntentFeedbackItem): boolean {
  if (item.status === "error") {
    return true;
  }
  return !/^(load|refresh)\b/i.test(item.message.trim());
}
