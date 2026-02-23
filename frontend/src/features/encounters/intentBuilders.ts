import type { ClientIntent } from "@/domain/ipc";
import type { EncounterPreset } from "@/domain/models";
import { makeId } from "@/shared/utils/id";

export function buildSaveEncounterIntent(encounter: EncounterPreset): ClientIntent {
  return {
    intentId: makeId("intent"),
    type: "save_encounter",
    payload: { encounter }
  };
}

export function buildSpawnEncounterIntent(encounterId: string): ClientIntent {
  return {
    intentId: makeId("intent"),
    type: "spawn_encounter",
    payload: { encounterId }
  };
}
