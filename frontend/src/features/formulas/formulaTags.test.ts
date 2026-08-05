import { describe, expect, it } from "vitest";
import { COMMON_FORMULA_TAGS, normalizeFormulaTags } from "@/features/formulas/formulaTags";

describe("formulaTags", () => {
  it("normalizes whitespace and case while preserving first-seen order", () => {
    expect(normalizeFormulaTags([" Damage ", "FIRE", "damage", "spell   attack"])).toEqual([
      "damage",
      "fire",
      "spell attack"
    ]);
  });

  it("provides semantic and canonical damage-type suggestions", () => {
    expect(COMMON_FORMULA_TAGS).toContain("check");
    expect(COMMON_FORMULA_TAGS).toContain("damage");
    expect(COMMON_FORMULA_TAGS).toContain("fire");
    expect(COMMON_FORMULA_TAGS).toContain("stealth");
    expect(COMMON_FORMULA_TAGS).toContain("parry");
    expect(COMMON_FORMULA_TAGS).toContain("mana_regeneration");
    expect(new Set(COMMON_FORMULA_TAGS).size).toBe(COMMON_FORMULA_TAGS.length);
  });
});
