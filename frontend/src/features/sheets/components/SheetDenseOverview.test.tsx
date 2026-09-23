// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SheetDenseOverview } from "./SheetDenseOverview";

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

function baseProps() {
  return {
    mode: "player" as const,
    instanceId: "hero",
    stats: { strength: 10, dexterity: 9 },
    unassignedPoints: 1,
    actions: <span>Actions</span>,
    kills: <span>Kills</span>,
    statuses: <span>Statuses</span>,
    attributes: <span>Attributes</span>,
    proficiencies: <span>Proficiencies</span>,
    inventory: <span>Inventory</span>,
    onAllocateStatPoints: vi.fn(),
    onAddCoreStatPoints: vi.fn()
  };
}

describe("SheetDenseOverview", () => {
  it("orders related substats alphabetically in reading order", async () => {
    const props = baseProps();
    await act(async () => root.render(<SheetDenseOverview {...props} />));

    const labels = Array.from(container.querySelectorAll(".dense-substat > span")).map(
      (entry) => entry.textContent
    );
    expect(labels).toEqual(
      [...labels].sort((left, right) => (left ?? "").localeCompare(right ?? ""))
    );
  });

  it("shows core modifiers and every damage-type resistance", async () => {
    const props = {
      ...baseProps(),
      resistances: {
        resistance: 0.1,
        physical: 0.2,
        magical: 0.3,
        fire: 0.4
      }
    };
    await act(async () => root.render(<SheetDenseOverview {...props} />));

    const coreModifiers = Array.from(
      container.querySelectorAll(".dense-resistances__core > div")
    ).map((entry) => entry.textContent);
    expect(coreModifiers).toEqual(["Total10%", "Physical20%", "Magical30%"]);
    expect(container.querySelector(".dense-resistances__grid")?.textContent).toContain("Fire40%");
    expect(container.querySelectorAll(".dense-resistances__grid > div")).toHaveLength(15);
  });

  it("stages player points, disables exhausted additions, and commits through the allocator", async () => {
    const props = baseProps();
    await act(async () => root.render(<SheetDenseOverview {...props} />));

    const addStrength = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Add Strength point"]'
    );
    expect(addStrength?.disabled).toBe(false);
    await act(async () => addStrength?.click());

    expect(container.textContent).toContain("0 of 1 unspent");
    expect(addStrength?.disabled).toBe(true);
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Remove staged Strength point"]'
      )?.disabled
    ).toBe(false);

    await act(async () =>
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Lock In 1"))
        ?.click()
    );
    expect(props.onAllocateStatPoints).toHaveBeenCalledWith({ strength: 1 });
  });

  it("greys allocation controls when the player has no unspent points", async () => {
    const props = { ...baseProps(), unassignedPoints: 0 };
    await act(async () => root.render(<SheetDenseOverview {...props} />));

    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Add Strength point"]')
        ?.disabled
    ).toBe(true);
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Remove staged Strength point"]'
      )?.disabled
    ).toBe(true);
  });

  it("routes GM stat additions to the existing grant dialog callback", async () => {
    const props = { ...baseProps(), mode: "gm" as const };
    await act(async () => root.render(<SheetDenseOverview {...props} />));

    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Grant Strength points"]')
        ?.click()
    );
    expect(props.onAddCoreStatPoints).toHaveBeenCalledWith("strength");
  });
});
