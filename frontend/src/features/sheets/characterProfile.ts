import type { CharacterProfile } from "@/domain/models";

export const CHARACTER_PROFILE_FIELDS = [
  "species",
  "background",
  "alignment",
  "pronouns",
  "age",
  "height",
  "weight",
  "eyes",
  "skin",
  "hair",
  "appearance",
  "personality_traits",
  "ideals",
  "bonds",
  "flaws",
  "allies_and_organizations",
  "backstory"
] as const satisfies readonly (keyof CharacterProfile)[];

export function createEmptyCharacterProfile(): CharacterProfile {
  return Object.fromEntries(
    CHARACTER_PROFILE_FIELDS.map((field) => [field, ""])
  ) as unknown as CharacterProfile;
}

export function resolveCharacterProfile(
  profile: Partial<CharacterProfile> | null | undefined
): CharacterProfile {
  const resolved = createEmptyCharacterProfile();
  for (const field of CHARACTER_PROFILE_FIELDS) {
    resolved[field] = profile?.[field] ?? "";
  }
  return resolved;
}

export function normalizeCharacterProfile(profile: CharacterProfile): CharacterProfile {
  return Object.fromEntries(
    CHARACTER_PROFILE_FIELDS.map((field) => [field, profile[field].trim()])
  ) as unknown as CharacterProfile;
}
