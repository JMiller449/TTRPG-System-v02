import { describe, expect, it } from "vitest";
import {
  addFormulaTags,
  COMMON_FORMULA_TAGS,
  normalizeFormulaTags,
  removeFormulaTag
} from "@/features/formulas/formulaTags";

describe("formulaTags", () => {
  it("normalizes whitespace and case while preserving first-seen order", () => {
    expect(normalizeFormulaTags([" Damage ", "FIRE", "damage", "spell   attack"])).toEqual([
      "damage",
      "fire",
      "spell attack"
    ]);
  });

  it("adds comma-separated custom tags and removes normalized matches", () => {
    expect(addFormulaTags(["damage"], " Fire, spell   attack, DAMAGE ")).toEqual([
      "damage",
      "fire",
      "spell attack"
    ]);
    expect(removeFormulaTag(["damage", "fire"], " FIRE ")).toEqual(["damage"]);
  });

  it("provides semantic and canonical damage-type suggestions", () => {
    expect(COMMON_FORMULA_TAGS).toContain("check");
    expect(COMMON_FORMULA_TAGS).toContain("damage");
    expect(COMMON_FORMULA_TAGS).toContain("fire");
    expect(new Set(COMMON_FORMULA_TAGS).size).toBe(COMMON_FORMULA_TAGS.length);
  });
});
