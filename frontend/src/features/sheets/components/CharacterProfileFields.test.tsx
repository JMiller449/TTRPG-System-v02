import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyCharacterProfile } from "@/features/sheets/characterProfile";
import { CharacterProfileFields } from "@/features/sheets/components/CharacterProfileFields";

describe("CharacterProfileFields", () => {
  it("omits pronouns from the background profile fields", () => {
    const markup = renderToStaticMarkup(
      <CharacterProfileFields
        profile={{ ...createEmptyCharacterProfile(), pronouns: "they/them" }}
        onChange={() => undefined}
      />
    );

    expect(markup).toContain("Background");
    expect(markup).toContain("Alignment");
    expect(markup).not.toContain("Pronouns");
    expect(markup).not.toContain("they/them");
  });
});
