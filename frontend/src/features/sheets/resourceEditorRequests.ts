import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";
import type { HealthDamageType, ResourceKey } from "@/features/sheets/sheetDisplay";
import {
  buildAdjustInstancedSheetResourceRequest,
  buildApplyInstancedSheetDamageRequest
} from "@/infrastructure/ws/requestBuilders";

export type ResourceModifierSubmission =
  | { request: ProtocolApplicationRequest; label: string }
  | { error: string };

export function buildResourceModifierSubmission({
  instanceId,
  resource,
  delta,
  damageType
}: {
  instanceId: string;
  resource: ResourceKey;
  delta: number;
  damageType: HealthDamageType;
}): ResourceModifierSubmission {
  if (resource === "health" && delta < 0) {
    if (!damageType) {
      return { error: "Select a damage type before applying damage." };
    }
    return {
      request: buildApplyInstancedSheetDamageRequest({
        instanceId,
        amount: Math.abs(delta),
        damageType
      }),
      label: `Apply ${damageType} damage`
    };
  }

  return {
    request: buildAdjustInstancedSheetResourceRequest({
      instanceId,
      resource,
      delta
    }),
    label: `Adjust ${resource}`
  };
}
