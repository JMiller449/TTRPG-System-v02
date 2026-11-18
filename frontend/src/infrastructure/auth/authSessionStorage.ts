export interface PersistedAuthSession {
  authToken: string;
  sheetAccessCode?: string;
}

export interface AuthSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const AUTH_SESSION_STORAGE_KEY = "ttrpg.auth-session.v1";

export function resolveBrowserAuthStorage(): AuthSessionStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadAuthSession(storage: AuthSessionStorage | null): PersistedAuthSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== "object" ||
      value === null ||
      !("authToken" in value) ||
      typeof value.authToken !== "string" ||
      !value.authToken.trim()
    ) {
      storage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }
    const sheetAccessCode =
      "sheetAccessCode" in value && typeof value.sheetAccessCode === "string"
        ? value.sheetAccessCode.trim()
        : "";
    return {
      authToken: value.authToken.trim(),
      ...(sheetAccessCode ? { sheetAccessCode } : {})
    };
  } catch {
    try {
      storage.removeItem(AUTH_SESSION_STORAGE_KEY);
    } catch {
      // Storage may be unavailable or blocked; login still works for this tab.
    }
    return null;
  }
}

export function saveAuthSession(
  storage: AuthSessionStorage | null,
  session: PersistedAuthSession
): void {
  if (!storage) return;
  try {
    storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage failures must not prevent a valid in-memory login.
  }
}

export function clearAuthSession(storage: AuthSessionStorage | null): void {
  if (!storage) return;
  try {
    storage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Storage failures must not break logout for the active tab.
  }
}
