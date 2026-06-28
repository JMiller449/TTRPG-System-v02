import { describe, expect, it } from "vitest";
import { shouldConnectApp } from "@/app/appConnection";

describe("App connection lifecycle", () => {
  it("connects immediately while unauthenticated when transport is disconnected", () => {
    expect(shouldConnectApp("disconnected")).toBe(true);
    expect(shouldConnectApp("connecting")).toBe(false);
    expect(shouldConnectApp("connected")).toBe(false);
  });
});
