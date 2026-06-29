import { describe, expect, it } from "vitest";
import {
  buildDeleteEncounterPresetSubmission,
  buildSaveEncounterPresetSubmission,
  buildSpawnEncounterPresetSubmission,
  toEncounterPresetPayload
} from "@/features/encounters/encounterRequests";

const encounter = {
  id: "encounter_1",
  name: "Two Mages",
  entries: [
    {
      templateId: "mage_template",
      count: 2
    }
  ],
  updatedAt: "2026-06-19T00:00:00+00:00"
};

describe("encounterRequests", () => {
  it("maps frontend encounter presets to backend payloads", () => {
    expect(toEncounterPresetPayload(encounter)).toEqual({
      id: "encounter_1",
      name: "Two Mages",
      entries: [
        {
          template_id: "mage_template",
          count: 2
        }
      ],
      updated_at: "2026-06-19T00:00:00+00:00"
    });
  });

  it("builds typed save encounter preset submissions", () => {
    expect(buildSaveEncounterPresetSubmission(encounter)).toEqual({
      request: {
        type: "save_encounter_preset",
        encounter: {
          id: "encounter_1",
          name: "Two Mages",
          entries: [
            {
              template_id: "mage_template",
              count: 2
            }
          ],
          updated_at: "2026-06-19T00:00:00+00:00"
        }
      },
      label: "Encounter save: Two Mages"
    });
  });

  it("builds typed spawn encounter preset submissions", () => {
    expect(buildSpawnEncounterPresetSubmission("encounter_1")).toEqual({
      request: {
        type: "spawn_encounter_preset",
        encounter_id: "encounter_1"
      },
      label: "Encounter spawn"
    });
  });

  it("builds confirmed typed delete encounter preset submissions", () => {
    expect(buildDeleteEncounterPresetSubmission(encounter)).toEqual({
      request: {
        type: "delete_encounter_preset",
        encounter_id: "encounter_1"
      },
      label: "Encounter delete: Two Mages",
      confirmation: 'Delete encounter preset "Two Mages" (encounter_1)? This cannot be undone.'
    });
  });
});
