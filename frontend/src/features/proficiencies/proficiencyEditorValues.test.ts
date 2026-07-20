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
    default_growth_rate: 0.01,
    ...overrides
  };
}

describe("proficiencyEditorValues", () => {
  it("creates empty editor values", () => {
    expect(createEmptyProficiencyEditorValues()).toEqual({
      id: "",
      name: "",
      description: "",
      category: "custom",
      defaultGrowthRate: "0.01"
    });
  });

  it("maps backend proficiency definitions into editor values", () => {
    expect(toProficiencyEditorValues(testProficiency())).toEqual({
      id: "longsword",
      name: "Longsword",
      description: "Tracks approved longsword use.",
      category: "custom",
      defaultGrowthRate: "0.01"
    });
  });

  it("validates the required name field", () => {
    expect(
      hasValidProficiencyEditorValues({
        id: " longsword ",
        name: " Longsword ",
        description: "",
        category: "weapon_family",
        defaultGrowthRate: "0.02"
      })
    ).toBe(true);
    expect(
      hasValidProficiencyEditorValues({
        id: "",
        name: "Longsword",
        description: "",
        category: "custom",
        defaultGrowthRate: "0.01"
      })
    ).toBe(true);
    expect(
      hasValidProficiencyEditorValues({
        id: "longsword",
        name: "",
        description: "",
        category: "custom",
        defaultGrowthRate: "0.01"
      })
    ).toBe(false);
    expect(
      hasValidProficiencyEditorValues({
        id: "longsword",
        name: "Longsword",
        description: "",
        category: "custom",
        defaultGrowthRate: "-0.01"
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
        category: "weapon_family",
        defaultGrowthRate: "0.025"
      })
    ).toEqual({
      id: "longsword",
      name: "Longsword",
      description: "Tracks approved longsword use.",
      category: "weapon_family",
      default_growth_rate: 0.025
    });
  });

  it("uses the existing id for update payloads", () => {
    expect(
      toUpdatedProficiencyDefinitionPayload(testProficiency(), {
        id: "ignored",
        name: " Longsword Mastery ",
        description: " Updated. ",
        category: "weapon_family",
        defaultGrowthRate: "0.005"
      })
    ).toEqual({
      id: "longsword",
      name: "Longsword Mastery",
      description: "Updated.",
      category: "weapon_family",
      default_growth_rate: 0.005
    });
    expect(
      toUpdatedProficiencyDefinitionPayload(undefined, {
        id: "longsword",
        name: "Longsword",
        description: "",
        category: "custom",
        defaultGrowthRate: "0.01"
      })
    ).toBeNull();
  });
});
