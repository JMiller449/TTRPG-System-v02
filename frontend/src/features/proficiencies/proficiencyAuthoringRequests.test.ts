import { describe, expect, it } from "vitest";
import type { ProficiencyDefinition } from "@/domain/models";
import {
  buildCreateProficiencySubmission,
  buildDeleteProficiencySubmission,
  buildUpdateProficiencySubmission,
  selectOrderedProficiencyDefinitions
} from "@/features/proficiencies/proficiencyAuthoringRequests";
import { createEmptyProficiencyEditorValues } from "@/features/proficiencies/proficiencyEditorValues";

function testProficiency(
  overrides: Partial<ProficiencyDefinition> = {}
): ProficiencyDefinition {
  return {
    id: "longsword",
    name: "Longsword",
    description: "Tracks approved longsword use.",
    ...overrides
  };
}

describe("proficiencyAuthoringRequests", () => {
  it("selects authoritative proficiencies in server order", () => {
    const first = testProficiency({ id: "longsword" });
    const second = testProficiency({ id: "fire_magic", name: "Fire Magic" });

    expect(
      selectOrderedProficiencyDefinitions(
        {
          longsword: first,
          fire_magic: second
        },
        ["fire_magic", "missing_prof", "longsword"]
      )
    ).toEqual([second, first]);
  });

  it("builds create submissions from editor values", () => {
    const values = createEmptyProficiencyEditorValues();
    values.id = " longsword ";
    values.name = " Longsword ";
    values.description = " Tracks approved longsword use. ";

    expect(buildCreateProficiencySubmission(values)).toEqual({
      request: {
        type: "create_proficiency",
        proficiency: {
          id: "longsword",
          name: "Longsword",
          description: "Tracks approved longsword use."
        }
      },
      label: "Create proficiency: Longsword"
    });
  });

  it("does not build create or update submissions for invalid values", () => {
    const values = createEmptyProficiencyEditorValues();
    values.id = "longsword";

    expect(buildCreateProficiencySubmission(values)).toBeNull();
    expect(buildUpdateProficiencySubmission(testProficiency(), values)).toBeNull();
  });

  it("builds update submissions without allowing id changes", () => {
    const values = createEmptyProficiencyEditorValues();
    values.id = "ignored";
    values.name = " Longsword Mastery ";
    values.description = " Updated. ";

    expect(buildUpdateProficiencySubmission(testProficiency(), values)).toEqual({
      request: {
        type: "update_proficiency",
        proficiency_id: "longsword",
        proficiency: {
          id: "longsword",
          name: "Longsword Mastery",
          description: "Updated."
        }
      },
      label: "Update proficiency: Longsword Mastery"
    });
    expect(buildUpdateProficiencySubmission(undefined, values)).toBeNull();
  });

  it("builds delete submissions with labels and missing-proficiency fallback", () => {
    expect(buildDeleteProficiencySubmission("longsword", testProficiency())).toEqual({
      request: {
        type: "delete_proficiency",
        proficiency_id: "longsword"
      },
      label: "Delete proficiency: Longsword"
    });

    expect(buildDeleteProficiencySubmission("missing_prof", undefined)).toEqual({
      request: {
        type: "delete_proficiency",
        proficiency_id: "missing_prof"
      },
      label: "Delete proficiency: missing_prof"
    });
  });
});
