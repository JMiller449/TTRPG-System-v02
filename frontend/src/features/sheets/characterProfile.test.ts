import { describe, expect, it } from "vitest";
import {
  CHARACTER_PROFILE_FIELDS,
  createEmptyCharacterProfile,
  normalizeCharacterProfile,
  resolveCharacterProfile
} from "@/features/sheets/characterProfile";

describe("characterProfile", () => {
  it("provides every supported flavor field with safe legacy defaults", () => {
    const profile = resolveCharacterProfile({ species: "Elf", height: "6 ft" });

    expect(Object.keys(profile)).toEqual([...CHARACTER_PROFILE_FIELDS]);
    expect(profile.species).toBe("Elf");
    expect(profile.height).toBe("6 ft");
    expect(profile.backstory).toBe("");
  });

  it("trims submitted profile text without changing the source draft", () => {
    const draft = createEmptyCharacterProfile();
    draft.species = "  Goblin  ";
    draft.backstory = "  Escaped an alchemist's workshop.  ";

    expect(normalizeCharacterProfile(draft)).toMatchObject({
      species: "Goblin",
      backstory: "Escaped an alchemist's workshop."
    });
    expect(draft.species).toBe("  Goblin  ");
  });
});
