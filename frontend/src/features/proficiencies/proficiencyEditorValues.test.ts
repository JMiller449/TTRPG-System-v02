import { describe, expect, it } from "vitest";
import type { ProficiencyDefinition } from "@/domain/models";
import {
  createEmptyProficiencyEditorValues,
  deriveProficiencyId,
  hasValidProficiencyEditorValues,
  toProficiencyDefinitionPayload,
  toProficiencyEditorValues,
  toUpdatedProficiencyDefinitionPayload
} from "@/features/proficiencies/proficiencyEditorValues";

function testProficiency(
  overrides: Partial<ProficiencyDefinition> = {}
): ProficiencyDefinition {
  return {
    id: "longsword",
    name: "Longsword",
    description: "Tracks approved longsword use.",
    category: "custom",
    ...overrides
  };
}

describe("proficiencyEditorValues", () => {
  it("creates empty editor values", () => {
    expect(createEmptyProficiencyEditorValues()).toEqual({
      id: "",
      name: "",
      description: "",
      category: "custom"
    });
  });

  it("maps backend proficiency definitions into editor values", () => {
    expect(toProficiencyEditorValues(testProficiency())).toEqual({
      id: "longsword",
      name: "Longsword",
      description: "Tracks approved longsword use.",
      category: "custom"
    });
  });

  it("validates the required name field", () => {
    expect(
      hasValidProficiencyEditorValues({
        id: " longsword ",
        name: " Longsword ",
        description: "",
        category: "weapon_family"
      })
    ).toBe(true);
    expect(
      hasValidProficiencyEditorValues({
        id: "",
        name: "Longsword",
        description: "",
        category: "custom"
      })
    ).toBe(true);
    expect(
      hasValidProficiencyEditorValues({
        id: "longsword",
        name: "",
        description: "",
        category: "custom"
      })
    ).toBe(false);
  });

  it("derives readable unique ids from names", () => {
    expect(deriveProficiencyId("Longsword", [])).toBe("longsword");
    expect(deriveProficiencyId("  Fire Magic!  ", [])).toBe("fire_magic");
    expect(deriveProficiencyId("Longsword", ["longsword"])).toBe("longsword_2");
    expect(deriveProficiencyId("Longsword", ["longsword", "longsword_2"])).toBe("longsword_3");
    expect(deriveProficiencyId("!!!", [])).toMatch(/^proficiency_/);
  });

  it("maps editor values to trimmed create payloads", () => {
    expect(
      toProficiencyDefinitionPayload({
        id: " longsword ",
        name: " Longsword ",
        description: " Tracks approved longsword use. ",
        category: "weapon_family"
      })
    ).toEqual({
      id: "longsword",
      name: "Longsword",
      description: "Tracks approved longsword use.",
      category: "weapon_family"
    });
  });

  it("uses the existing id for update payloads", () => {
    expect(
      toUpdatedProficiencyDefinitionPayload(testProficiency(), {
        id: "ignored",
        name: " Longsword Mastery ",
        description: " Updated. ",
        category: "weapon_family"
      })
    ).toEqual({
      id: "longsword",
      name: "Longsword Mastery",
      description: "Updated.",
      category: "weapon_family"
    });
    expect(
      toUpdatedProficiencyDefinitionPayload(undefined, {
        id: "longsword",
        name: "Longsword",
        description: "",
        category: "custom"
      })
    ).toBeNull();
  });
});
