import { describe, expect, it } from "vitest";
import {
  buildXpPreview,
  XpPreviewLimitError,
  previewEquation,
  previewAttributeIds
} from "./xpCurvePreviewMath";

const defaults = {
  mode: "tuning" as const,
  base_xp: 100,
  growth_exponent: 1.35,
  milestone_interval: 25,
  milestone_multiplier: 1.08,
  growth_multiplier_per_milestone: 1.02,
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
        growth_multiplier_per_milestone: 1.5
      },
      6,
      1
    );
    expect(curve.map((point) => point.needed)).toEqual([100, 400, 520, 800, 2240, 5630]);
    expect(curve[2].total).toBe(1020);
    expect(
      buildXpPreview({ ...defaults, growth_multiplier_per_milestone: 1 }, 26, 1)[25].needed
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

it("compounds the exponent after the first milestone", () => {
  const points = buildXpPreview(defaults, 26, 1);
  expect(points[23]).toEqual({ level: 24, needed: 7880, total: 78800 });
  expect(points[24]).toEqual({ level: 25, needed: 8410, total: 87210 });
  expect(points[25]).toEqual({ level: 26, needed: 8880, total: 96090 });
  expect(buildXpPreview({ ...defaults, base_xp: 105 }, 1, 1)[0].needed).toBe(110);
});

it("keeps valid levels when a later goal exceeds the supported range", () => {
  try {
    buildXpPreview(
      {
        ...defaults,
        growth_exponent: 2,
        milestone_interval: 10,
        growth_multiplier_per_milestone: 2
      },
      250,
      1
    );
    expect.fail("Expected the preview limit to be reached");
  } catch (error) {
    expect(error).toBeInstanceOf(XpPreviewLimitError);
    expect((error as XpPreviewLimitError).points.length).toBeGreaterThan(0);
    expect(
      (error as XpPreviewLimitError).points.every((point) => Number.isFinite(point.total))
    ).toBe(true);
  }
});
