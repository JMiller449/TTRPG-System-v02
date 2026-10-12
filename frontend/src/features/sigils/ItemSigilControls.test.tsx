// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ItemSigilControls } from "./ItemSigilControls";
import type { ItemSigilNode } from "./sigilItemActions";

describe("weapon sigil controls", () => {
  it("renders the charge on the weapon, activates its Action, and offers recharge after discharge", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    let entries: ItemSigilNode[] = [
      {
        sigilId: "sigil",
        sigilName: "Flame",
        node: {
          id: "node",
          name: "Flame",
          diameter: 2,
          action_id: "fire",
          charge: {
            action_id: "fire",
            imbuer_instance_id: "mage",
            action_signature: "sig",
            mana_paid: 4
          },
          last_imbuer_instance_id: "mage"
        }
      }
    ];
    const onActivate = vi.fn();
    const onRecharge = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);
    const render = async () =>
      act(async () =>
        root.render(
          <ItemSigilControls
            entries={entries}
            available
            actions={{ fire: { id: "fire", name: "Fire", notes: "", steps: [], attributes: {} } }}
            onActivate={onActivate}
            onRecharge={onRecharge}
          />
        )
      );
    const button = (name: string) =>
      [...container.querySelectorAll("button")].find((element) => element.textContent === name)!;
    try {
      await render();
      expect(container.textContent).toContain("Charged");
      await act(async () => button("Activate Fire").click());
      expect(onActivate).toHaveBeenCalledWith("sigil", "node");
      entries = [{ ...entries[0], node: { ...entries[0].node, charge: null } }];
      await render();
      expect(container.textContent).toContain("Uncharged");
      expect(button("Activate Fire").disabled).toBe(true);
      await act(async () => button("Recharge sigil").click());
      expect(onRecharge).toHaveBeenCalledWith("sigil", "node");
    } finally {
      await act(async () => root.unmount());
    }
  });
});
