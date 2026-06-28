import type { ActionRollModeKind } from "@/domain/models";
import type { ActionRollMode } from "@/infrastructure/ws/requestBuilders";

export function actionRollModes(modeKind: ActionRollModeKind): ActionRollMode[] {
  if (modeKind === "check") {
    return ["normal", "advantage", "disadvantage"];
  }
  if (modeKind === "damage") {
    return ["normal", "critical"];
  }
  return ["normal"];
}
