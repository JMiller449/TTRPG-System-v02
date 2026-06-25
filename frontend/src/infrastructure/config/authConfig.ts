import type { Role } from "@/domain/models";

export interface AuthCodeEnv {
  VITE_PLAYER_AUTH_TOKEN?: string;
  VITE_DM_AUTH_TOKEN?: string;
}

function readCode(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

export function resolveDefaultAuthToken(
  role: Role,
  env: AuthCodeEnv = import.meta.env as AuthCodeEnv
): string | null {
  if (role === "gm") {
    return readCode(env.VITE_DM_AUTH_TOKEN);
  }
  return readCode(env.VITE_PLAYER_AUTH_TOKEN);
}
