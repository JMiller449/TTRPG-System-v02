import { describe, expect, it } from "vitest";
import { buildXpPreview, previewEquation, previewAttributeIds } from "./xpCurvePreview";

const defaults = {
  mode: "tuning" as const,
  base_xp: 100,
  growth_exponent: 1.35,
  milestone_interval: 25,
  milestone_multiplier: 1.08,
  growth_increase_per_milestone: 0.02,
  rounding: 10
};
describe("Local XP curve previews", () => {
  it("distinguishes incremental costs from lifetime targets", () => {
    expect(buildXpPreview(defaults, 3, 1)).toEqual([
      { level: 1, total: 100, needed: 100 },
      { level: 2, total: 350, needed: 250 },
      { level: 3, total: 790, needed: 440 }
    ]);
  });
  it("applies milestone bumps, growth, and final rounding", () => {
    const curve = buildXpPreview(
      {
        ...defaults,
        growth_exponent: 1,
        milestone_interval: 3,
        milestone_multiplier: 2,
        growth_increase_per_milestone: 0.5
      },
      6,
      1
    );
    expect(curve.map((point) => point.needed)).toEqual([100, 400, 510, 800, 2230, 3600]);
    expect(curve[2].total).toBe(1010);
    expect(
      buildXpPreview({ ...defaults, growth_increase_per_milestone: 0 }, 26, 1)[25].needed
    ).toBe(8130);
    expect(buildXpPreview({ ...defaults, base_xp: 101 }, 1, 1.2)[0].total).toBe(120);
  });
  it("evaluates sample Attributes with arithmetic precedence and Python-style rounding", () => {
    const draft = {
      ...defaults,
      mode: "formula" as const,
      expression: "max(100, @level ** 2 * @{factor-id})"
    };
    expect(previewAttributeIds(draft.expression)).toEqual(["level", "factor-id"]);
    expect(buildXpPreview(draft, 2, 1.2, { "factor-id": 200 })[1].total).toBe(960);
    expect(previewEquation("-2 ** 2 + 10 // 3 + -5 % 3", {})).toBe(0);
    expect(previewEquation("round(2.5) + round(3.5) + ceil(1.2) + floor(1.8)", {})).toBe(9);
  });
  it("rejects incomplete inputs, non-finite goals, and executable text", () => {
    for (const expression of [
      "",
      "1 / 0",
      "@missing",
      "1d100",
      "window.alert(1)",
      "1 +",
      "Math.random()"
    ])
      expect(() => previewEquation(expression, {})).toThrow();
    expect(() => buildXpPreview({ ...defaults, rounding: 0 }, 10, 1)).toThrow();
    expect(() => buildXpPreview(defaults, 10, NaN)).toThrow();
  });
});
