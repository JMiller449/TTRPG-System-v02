// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsoleSidebarSearch } from "@/features/console/ConsoleSidebarSearch";

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

async function renderSearch(role: "player" | "gm") {
  const onNavigate = vi.fn();
  const onCharacterSectionChange = vi.fn();
  await act(async () => {
    root.render(
      <ConsoleSidebarSearch
        role={role}
        onNavigate={onNavigate}
        onCharacterSectionChange={onCharacterSectionChange}
      />
    );
  });
  const input = container.querySelector<HTMLInputElement>('[role="combobox"]');
  if (!input) {
    throw new Error("Navigation search input did not render");
  }
  return { input, onNavigate, onCharacterSectionChange };
}

async function enterQuery(input: HTMLInputElement, query: string): Promise<void> {
  await act(async () => {
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, query);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("ConsoleSidebarSearch", () => {
  it("selects the top matching destination with Enter", async () => {
    const { input, onNavigate, onCharacterSectionChange } = await renderSearch("player");
    await enterQuery(input, "statuses");

    expect(container.querySelector('[role="option"]')?.textContent).toContain("CharactersStatuses");
    await act(async () =>
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    );

    expect(onCharacterSectionChange).toHaveBeenCalledWith("statuses");
    expect(onNavigate).toHaveBeenCalledWith("sheet_viewer");
    expect(input.value).toBe("");
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("uses wrapping arrow navigation before activating a result", async () => {
    const { input, onNavigate, onCharacterSectionChange } = await renderSearch("player");
    await act(async () => input.focus());
    await act(async () =>
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }))
    );
    await act(async () =>
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }))
    );
    await act(async () =>
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    );

    expect(onCharacterSectionChange).toHaveBeenCalledWith("stats");
    expect(onNavigate).toHaveBeenCalledWith("sheet_viewer");
  });

  it("excludes GM-only destinations from player results", async () => {
    const { input } = await renderSearch("player");
    await enterQuery(input, "management");

    expect(container.textContent).toContain("No matching destinations.");
    expect(container.textContent).not.toContain("Management");
  });

  it("finds GM destinations and clears results with Escape", async () => {
    const { input, onNavigate, onCharacterSectionChange } = await renderSearch("gm");
    await enterQuery(input, "backup");
    await act(async () =>
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    );

    expect(onNavigate).toHaveBeenCalledWith("state_backup");
    expect(onCharacterSectionChange).not.toHaveBeenCalled();

    await enterQuery(input, "manage");
    expect(container.textContent).toContain("Management");
    await act(async () =>
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    );
    expect(input.value).toBe("");
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });
});
