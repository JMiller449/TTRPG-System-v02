import { describe, expect, it } from "vitest";
import {
  AUTH_SESSION_STORAGE_KEY,
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
  type AuthSessionStorage
} from "@/infrastructure/auth/authSessionStorage";

export class MemoryAuthStorage implements AuthSessionStorage {
  values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("auth session storage", () => {
  it("round-trips an authentication token and optional sheet claim", () => {
    const storage = new MemoryAuthStorage();
    saveAuthSession(storage, { authToken: "player", sheetAccessCode: "hero" });

    expect(loadAuthSession(storage)).toEqual({
      authToken: "player",
      sheetAccessCode: "hero"
    });

    clearAuthSession(storage);
    expect(loadAuthSession(storage)).toBeNull();
  });

  it("drops malformed persisted values", () => {
    const storage = new MemoryAuthStorage();
    storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({ authToken: "" }));

    expect(loadAuthSession(storage)).toBeNull();
    expect(storage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
  });
});
