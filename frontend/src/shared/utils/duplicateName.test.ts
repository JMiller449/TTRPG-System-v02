import { describe, expect, it } from "vitest";
import { nextDuplicateName } from "@/shared/utils/duplicateName";

describe("nextDuplicateName", () => {
  it("adds the first numeric suffix", () => {
    expect(nextDuplicateName("Test", ["Test"])).toBe("Test1");
  });

  it("increments an existing suffix instead of appending another one", () => {
    expect(nextDuplicateName("Test1", ["Test", "Test1"])).toBe("Test2");
  });

  it("skips occupied names case-insensitively", () => {
    expect(nextDuplicateName("Test", ["test", "TEST1", "Test2"])).toBe("Test3");
  });
});
