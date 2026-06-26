import type { EncounterPreset } from "@/domain/models";
import {
  buildSaveEncounterPresetRequest,
  buildSpawnEncounterPresetRequest,
  type EncounterPresetPayload
} from "@/infrastructure/ws/requestBuilders";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";

export interface EncounterSubmission {
  request: ProtocolApplicationRequest;
  label: string;
}

export function toEncounterPresetPayload(encounter: EncounterPreset): EncounterPresetPayload {
  return {
    id: encounter.id,
    name: encounter.name,
    entries: encounter.entries.map((entry) => ({
      template_id: entry.templateId,
      count: entry.count
    })),
    updated_at: encounter.updatedAt
  };
}

export function buildSaveEncounterPresetSubmission(encounter: EncounterPreset): EncounterSubmission {
  return {
    request: buildSaveEncounterPresetRequest({
      encounter: toEncounterPresetPayload(encounter)
    }),
    label: `Encounter save: ${encounter.name}`
  };
}

export function buildSpawnEncounterPresetSubmission(encounterId: string): EncounterSubmission {
  return {
    request: buildSpawnEncounterPresetRequest({ encounterId }),
    label: "Encounter spawn"
  };
}
