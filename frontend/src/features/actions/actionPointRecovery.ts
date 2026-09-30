import type { ActionDefinition } from "@/domain/models";

export function actionNeedsPointRefill(
  action: ActionDefinition,
  currentPoints: number,
  maximumPoints: number
): boolean {
  const outcome = (startingPoints: number): "ok" | "insufficient" | "other-limit" => {
    let available = startingPoints;

    for (const step of action.steps ?? []) {
      if (step.type !== "adjust_action_points") {
        continue;
      }

      const amount = step.amount ?? 1;
      if ((step.operation ?? "consume") === "consume") {
        if (amount > available) {
          return "insufficient";
        }
        available -= amount;
        continue;
      }

      if (available + amount > maximumPoints) {
        return "other-limit";
      }
      available += amount;
    }

    return "ok";
  };

  return outcome(currentPoints) === "insufficient" && outcome(maximumPoints) === "ok";
}
