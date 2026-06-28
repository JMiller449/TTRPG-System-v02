import { describe, expect, it } from "vitest";
import { DAMAGE_TYPES } from "@/domain/models";
import {
  formatModifier,
  parseModifierInput,
  PLAYER_HEALTH_DAMAGE_TYPES
} from "@/features/sheets/sheetDisplay";

describe("sheetDisplay modifier helpers", () => {
  it("parses whole-number resource and stat modifiers used by sheet edit controls", () => {
    expect(parseModifierInput("")).toBe(0);
    expect(parseModifierInput("  +10 ")).toBe(10);
    expect(parseModifierInput("-7")).toBe(-7);
    expect(parseModifierInput("0")).toBe(0);

    expect(parseModifierInput("1.5")).toBeNull();
    expect(parseModifierInput("+")).toBeNull();
    expect(parseModifierInput("ten")).toBeNull();
  });

  it("formats modifier values with explicit signs for positive adjustments", () => {
    expect(formatModifier(5)).toBe("+5");
    expect(formatModifier(0)).toBe("0");
    expect(formatModifier(-3)).toBe("-3");
  });

  it("offers only canonical backend damage types", () => {
    expect(PLAYER_HEALTH_DAMAGE_TYPES.map((option) => option.value)).toEqual(DAMAGE_TYPES);
  });
});
