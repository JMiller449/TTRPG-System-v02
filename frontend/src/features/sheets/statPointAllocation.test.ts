import { describe, expect, it } from "vitest";
import {
  createEmptyStatPointAllocation,
  decrementStatPointAllocation,
  incrementStatPointAllocation,
  positiveStatPointAllocationPayload,
  sumStatPointAllocation
} from "@/features/sheets/statPointAllocation";

describe("statPointAllocation", () => {
  it("tracks only points added in the current allocation", () => {
    const empty = createEmptyStatPointAllocation();
    const withStrength = incrementStatPointAllocation(empty, "strength", 2);
    const withArcane = incrementStatPointAllocation(withStrength, "arcane", 2);
    const overspent = incrementStatPointAllocation(withArcane, "will", 2);

    expect(sumStatPointAllocation(withArcane)).toBe(2);
    expect(overspent).toBe(withArcane);
    expect(positiveStatPointAllocationPayload(withArcane)).toEqual({
      strength: 1,
      arcane: 1
    });
  });

  it("does not subtract below the points staged in this allocation", () => {
    const empty = createEmptyStatPointAllocation();
    const decrementedEmpty = decrementStatPointAllocation(empty, "strength");
    const withStrength = incrementStatPointAllocation(empty, "strength", 2);
    const decremented = decrementStatPointAllocation(withStrength, "strength");

    expect(decrementedEmpty).toBe(empty);
    expect(decremented.strength).toBe(0);
    expect(sumStatPointAllocation(decremented)).toBe(0);
  });
});
