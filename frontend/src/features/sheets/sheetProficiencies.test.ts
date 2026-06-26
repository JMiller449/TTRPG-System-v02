import { describe, expect, it } from "vitest";
import type { ProficiencyBridge, ProficiencyDefinition } from "@/domain/models";
import {
  parseSheetProficiencyGrowthRate,
  parseSheetProficiencyUseCount,
  selectAvailableSheetProficiencies,
  selectSheetProficiencyEntries,
  toSheetProficiencyBridgePayload
} from "@/features/sheets/sheetProficiencies";

function testProficiency(overrides: Partial<ProficiencyDefinition> = {}): ProficiencyDefinition {
  return {
    id: "longsword",
    name: "Longsword",
    description: "Tracks approved longsword use.",
    ...overrides
  };
}

function testBridge(overrides: Partial<ProficiencyBridge> = {}): ProficiencyBridge {
  return {
    relationship_id: "longsword",
    prof_id: "longsword",
    use_count: 3,
    growth_rate: 1,
    ...overrides
  };
}

describe("sheetProficiencies", () => {
  it("resolves sheet bridges against global proficiency definitions", () => {
    expect(
      selectSheetProficiencyEntries(
        [testBridge(), testBridge({ relationship_id: "missing", prof_id: "missing_prof" })],
        { longsword: testProficiency() }
      )
    ).toEqual([
      {
        bridge: testBridge(),
        proficiency: testProficiency(),
        label: "Longsword"
      },
      {
        bridge: testBridge({ relationship_id: "missing", prof_id: "missing_prof" }),
        proficiency: null,
        label: "missing_prof"
      }
    ]);
  });

  it("offers only ordered global proficiencies not already assigned to the sheet", () => {
    const longsword = testProficiency();
    const fireMagic = testProficiency({ id: "fire_magic", name: "Fire Magic" });

    expect(
      selectAvailableSheetProficiencies(
        { longsword, fire_magic: fireMagic },
        ["fire_magic", "missing_prof", "longsword"],
        [testBridge({ prof_id: "fire_magic" })]
      )
    ).toEqual([longsword]);
  });

  it("parses bridge numeric fields with strict non-negative constraints", () => {
    expect(parseSheetProficiencyUseCount("0")).toBe(0);
    expect(parseSheetProficiencyUseCount("12")).toBe(12);
    expect(parseSheetProficiencyUseCount("1.5")).toBeNull();
    expect(parseSheetProficiencyUseCount("-1")).toBeNull();

    expect(parseSheetProficiencyGrowthRate("0")).toBe(0);
    expect(parseSheetProficiencyGrowthRate("0.75")).toBe(0.75);
    expect(parseSheetProficiencyGrowthRate("fast")).toBeNull();
    expect(parseSheetProficiencyGrowthRate("-0.25")).toBeNull();
  });

  it("builds sheet proficiency bridge payloads", () => {
    expect(
      toSheetProficiencyBridgePayload({
        relationshipId: "longsword",
        proficiencyId: "longsword",
        useCount: 2,
        growthRate: 0.5
      })
    ).toEqual({
      relationship_id: "longsword",
      prof_id: "longsword",
      use_count: 2,
      growth_rate: 0.5
    });
  });
});
