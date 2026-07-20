// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyCharacterProfile } from "@/features/sheets/characterProfile";
import { SheetProfileSection } from "@/features/sheets/components/SheetProfileSection";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("SheetProfileSection", () => {
  it("edits structured flavor fields and submits one complete profile", async () => {
    const onSave = vi.fn();
    await act(async () => {
      root.render(
        <SheetProfileSection
          sheetId="hero"
          profile={{ species: "Human", backstory: "Old history" }}
          onSave={onSave}
        />
      );
    });

    const species = container.querySelector<HTMLInputElement>('input[value="Human"]');
    const backstory = container.querySelector<HTMLTextAreaElement>("textarea[rows='10']");
    expect(species).not.toBeNull();
    expect(backstory?.value).toBe("Old history");
    expect(container.querySelector(".sheet-profile-section__status")?.textContent).toBe(
      "All changes saved"
    );

    await act(async () => {
      if (species) setValue(species, "Moon Elf");
      if (backstory) setValue(backstory, "New history");
    });

    expect(container.querySelector(".sheet-profile-section__status")?.textContent).toBe(
      "Unsaved changes"
    );
    const save = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Save Profile"
    );
    await act(async () => save?.click());

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toEqual({
      ...createEmptyCharacterProfile(),
      species: "Moon Elf",
      backstory: "New history"
    });
  });
});
