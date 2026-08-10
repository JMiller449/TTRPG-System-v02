// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DAMAGE_TYPES, type DamageType, type Resistances } from "@/domain/models";
import { SheetResistancesEditor } from "@/features/sheets/components/SheetResistancesEditor";

const resistances: Resistances = {
  resistance: 0.1,
  physical: 0.2,
  magical: 0.3,
  slashing: 0,
  bludgeoning: 0,
  piercing: 0,
  arcane: 0,
  fire: 0.25,
  water: 0,
  earth: 0,
  wind: 0,
  light: 0,
  dark: 0,
  lightning: 0,
  ice: 0,
  time: 0,
  gravity: 0,
  psychic: 0
};

const damageTakenByType = Object.fromEntries(
  DAMAGE_TYPES.map((damageType) => [damageType, damageType === "Fire" ? 12 : 0])
) as Record<DamageType, number>;

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

describe("SheetResistancesEditor", () => {
  it("groups read-only core and damage-type resistances into summary cards", async () => {
    await act(async () => {
      root.render(createElement(SheetResistancesEditor, { resistances, readOnly: true }));
    });

    expect(
      container.querySelectorAll(".sheet-resistance-grid--core .sheet-resistance-card")
    ).toHaveLength(3);
    expect(
      container.querySelectorAll(".sheet-resistance-grid--types .sheet-resistance-card")
    ).toHaveLength(15);
    expect(container.textContent).toContain("Fire25%");
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(0);
  });

  it("keeps every resistance editable for the DM", async () => {
    await act(async () => {
      root.render(createElement(SheetResistancesEditor, { resistances, onSave: () => undefined }));
    });

    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(18);
    expect(container.querySelectorAll(".sheet-resistance-card")).toHaveLength(0);
    expect(container.textContent).toContain("Save Resistances");
  });

  it("shows GM damage trackers beside damage-type resistances and resets one type", async () => {
    let resetType: DamageType | null = null;
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await act(async () => {
      root.render(
        createElement(SheetResistancesEditor, {
          resistances,
          damageTakenByType,
          onSave: () => undefined,
          onResetDamageTracker: (damageType) => {
            resetType = damageType;
          }
        })
      );
    });

    expect(container.querySelectorAll(".sheet-resistance-card--editable")).toHaveLength(15);
    const fireInput = container.querySelector('input[aria-label="Fire resistance (%)"]');
    const fireCard = fireInput?.closest(".sheet-resistance-card--editable");
    expect(fireCard?.textContent).toContain("Damage taken12Reset");

    await act(async () => {
      (fireCard?.querySelector("button") as HTMLButtonElement).click();
    });
    expect(resetType).toBe("Fire");

    resetType = null;
    confirm.mockReturnValue(false);
    await act(async () => {
      (fireCard?.querySelector("button") as HTMLButtonElement).click();
    });
    expect(resetType).toBeNull();
    confirm.mockRestore();
  });
});
