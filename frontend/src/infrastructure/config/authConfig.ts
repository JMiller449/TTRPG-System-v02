import type { Role } from "@/domain/models";

export interface AuthCodeEnv {
  VITE_PLAYER_AUTH_TOKEN?: string;
  VITE_DM_AUTH_TOKEN?: string;
}

export const LOCAL_DEV_PLAYER_AUTH_TOKEN = "player";
export const LOCAL_DEV_DM_AUTH_TOKEN = "dm";

function readCode(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function resolveDefaultAuthToken(
  role: Role,
  env: AuthCodeEnv = import.meta.env as AuthCodeEnv
): string {
  if (role === "gm") {
    return readCode(env.VITE_DM_AUTH_TOKEN, LOCAL_DEV_DM_AUTH_TOKEN);
  }
  return readCode(env.VITE_PLAYER_AUTH_TOKEN, LOCAL_DEV_PLAYER_AUTH_TOKEN);
}
