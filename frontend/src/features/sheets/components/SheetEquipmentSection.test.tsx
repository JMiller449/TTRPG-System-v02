// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ItemDefinition } from "@/domain/models";
import { SheetEquipmentSection } from "@/features/sheets/components/SheetEquipmentSection";

const sword = {
  id: "sword",
  name: "Sword",
  interaction_type: "equippable",
  description: "",
  price: "",
  weight: 0,
  effect_ids: []
} as ItemDefinition;

describe("SheetEquipmentSection", () => {
  it("shows a charged sigil Action and status on only the bound weapon copy", () => {
    const markup = renderToStaticMarkup(
      <SheetEquipmentSection
        items={{ sword }}
        actionDefinitions={{
          fire: { id: "fire", name: "Fire", notes: "", steps: [], attributes: {} }
        }}
        attributeDefinitions={{}}
        proficiencyDefinitions={{}}
        augmentations={{}}
        itemOrder={["sword"]}
        selectedItemId="sword"
        selectedItem={sword}
        equipment={[
          { relationship_id: "first", item_id: "sword", count: 1, equipped: true },
          { relationship_id: "second", item_id: "sword", count: 1, equipped: true }
        ]}
        currentCarriedWeight={0}
        carryWeightLimit={10}
        canManageInventory={false}
        canEditInventory={false}
        canMoveInventory={false}
        canToggleEquipped={false}
        instanceId="mage"
        sigils={{
          flame: {
            id: "flame",
            owner_instance_id: "mage",
            item_relationship_id: "first",
            nodes: [
              {
                id: "root",
                name: "Flame",
                diameter: 2,
                action_id: "fire",
                charge: {
                  action_id: "fire",
                  imbuer_instance_id: "mage",
                  action_signature: "sig",
                  mana_paid: 4
                }
              }
            ]
          }
        }}
        onActivateSigil={vi.fn()}
        onRechargeSigil={vi.fn()}
        onSelectedItemIdChange={vi.fn()}
        onAddSelectedItem={vi.fn()}
        onQuantityChange={vi.fn()}
        onToggleEquipped={vi.fn()}
        onMoveInventoryItem={vi.fn()}
        onRemoveInventoryItem={vi.fn()}
      />
    );
    const container = document.createElement("div");
    container.innerHTML = markup;
    const cards = container.querySelectorAll("article.equipment-card--owned");
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain("Charged");
    expect(cards[0].textContent).toContain("Activate Fire");
    expect(cards[1].textContent).not.toContain("Flame");
    expect(cards[1].textContent).not.toContain("Activate Fire");
  });
  it("lets players add, remove, edit quantities, equip, and organize items", () => {
    const markup = renderToStaticMarkup(
      <SheetEquipmentSection
        items={{ sword }}
        actionDefinitions={{}}
        attributeDefinitions={{}}
        proficiencyDefinitions={{}}
        augmentations={{}}
        itemOrder={["sword"]}
        selectedItemId="sword"
        selectedItem={sword}
        equipment={[
          {
            relationship_id: "main_hand",
            item_id: "sword",
            count: 1,
            equipped: false
          }
        ]}
        currentCarriedWeight={10}
        carryWeightLimit={10}
        canManageInventory
        canEditInventory
        canMoveInventory
        canToggleEquipped
        onOpenCreateItem={() => undefined}
        onSelectedItemIdChange={() => undefined}
        onAddSelectedItem={() => undefined}
        onQuantityChange={() => undefined}
        onToggleEquipped={() => undefined}
        onMoveInventoryItem={() => undefined}
        onRemoveInventoryItem={() => undefined}
      />
    );

    expect(markup).toContain('aria-label="Equip: Sword"');
    expect(markup).toContain("Add Existing");
    expect(markup).toContain("Create Item");
    expect(markup).toContain("Carried Weight: 10 / 10 lb");
    expect(markup).toContain('aria-label="Owned inventory items"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).not.toContain("over capacity");
    expect(markup).toContain('aria-label="Sword quantity value: 1. Adjust in bulk"');
    expect(markup).toContain('aria-label="Decrease Sword quantity"');
    expect(markup).toContain('aria-label="Increase Sword quantity"');
    expect(markup).toContain('aria-label="Remove Sword from inventory"');
    expect(markup).not.toContain("Storage location for Sword");
  });

  it("moves add and create flows into focused dialogs", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const onAddSelectedItem = vi.fn();
    const onOpenCreateItem = vi.fn();

    await act(async () => {
      root.render(
        <SheetEquipmentSection
          items={{ sword }}
          actionDefinitions={{}}
          attributeDefinitions={{}}
          proficiencyDefinitions={{}}
          augmentations={{}}
          itemOrder={["sword"]}
          selectedItemId="sword"
          selectedItem={sword}
          equipment={[]}
          currentCarriedWeight={0}
          carryWeightLimit={10}
          canManageInventory
          canEditInventory
          canMoveInventory
          canToggleEquipped
          onOpenCreateItem={onOpenCreateItem}
          onSelectedItemIdChange={() => undefined}
          onAddSelectedItem={onAddSelectedItem}
          onQuantityChange={() => undefined}
          onToggleEquipped={() => undefined}
          onMoveInventoryItem={() => undefined}
          onRemoveInventoryItem={() => undefined}
        />
      );
    });

    const addExistingButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Add Existing"
    );
    await act(async () => addExistingButton?.click());
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("Add existing Item");

    const addItemButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Add Item"
    );
    await act(async () => addItemButton?.click());
    expect(onAddSelectedItem).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    const createItemButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Create Item"
    );
    await act(async () => createItemButton?.click());
    expect(onOpenCreateItem).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
  });

  it("shows container capacity without expanding contained items into the root grid", () => {
    const bag: ItemDefinition = {
      id: "bag",
      name: "Bag of Holding",
      interaction_type: "inventory_only",
      description: "",
      price: "",
      weight: 2,
      can_contain_items: true,
      storage_capacity_weight: 20,
      contents_weight_behavior: "ignored"
    };
    const markup = renderToStaticMarkup(
      <SheetEquipmentSection
        items={{ sword, bag }}
        actionDefinitions={{}}
        attributeDefinitions={{}}
        proficiencyDefinitions={{}}
        augmentations={{}}
        itemOrder={["bag", "sword"]}
        selectedItemId=""
        selectedItem={null}
        equipment={[
          {
            relationship_id: "bag-entry",
            item_id: "bag",
            count: 1,
            equipped: false,
            current_contents_weight: 3
          },
          {
            relationship_id: "sword-entry",
            item_id: "sword",
            count: 1,
            equipped: false,
            parent_container_id: "bag-entry"
          }
        ]}
        currentCarriedWeight={12.5}
        carryWeightLimit={10}
        canManageInventory={false}
        canEditInventory={false}
        canMoveInventory={false}
        canToggleEquipped={false}
        onSelectedItemIdChange={() => undefined}
        onAddSelectedItem={() => undefined}
        onQuantityChange={() => undefined}
        onToggleEquipped={() => undefined}
        onMoveInventoryItem={() => undefined}
        onRemoveInventoryItem={() => undefined}
      />
    );

    expect(markup).toContain("Carried Weight: 12.5 / 10 lb");
    expect(markup).toContain("2.5 lb over capacity");
    expect(markup).toContain("Stored weight: 3 / 20 lb");
    expect(markup).toContain("Stored contents do not add to carried weight.");
    expect(markup).toContain("1 direct item");
    expect(markup).toContain("View Inside");
    expect(markup).not.toContain("Stored in Bag of Holding");
    expect(markup).not.toContain("Sword");
  });

  it("opens direct contents and navigates nested containers from Dense inventory", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const bag: ItemDefinition = {
      id: "bag",
      name: "Magic Bag",
      interaction_type: "inventory_only",
      description: "",
      price: "",
      weight: 1,
      can_contain_items: true,
      storage_capacity_weight: 20,
      contents_weight_behavior: "ignored"
    };
    const pouch: ItemDefinition = {
      ...bag,
      id: "pouch",
      name: "Inner Pouch",
      storage_capacity_weight: 5,
      contents_weight_behavior: "normal"
    };

    await act(async () => {
      root.render(
        <SheetEquipmentSection
          dense
          items={{ sword, bag, pouch }}
          actionDefinitions={{}}
          attributeDefinitions={{}}
          proficiencyDefinitions={{}}
          augmentations={{}}
          itemOrder={["bag", "pouch", "sword"]}
          selectedItemId=""
          selectedItem={null}
          equipment={[
            {
              relationship_id: "bag-entry",
              item_id: "bag",
              count: 1,
              equipped: false,
              current_contents_weight: 4
            },
            {
              relationship_id: "pouch-entry",
              item_id: "pouch",
              count: 1,
              equipped: false,
              parent_container_id: "bag-entry",
              current_contents_weight: 3
            },
            {
              relationship_id: "sword-entry",
              item_id: "sword",
              count: 1,
              equipped: false,
              parent_container_id: "pouch-entry"
            }
          ]}
          currentCarriedWeight={2}
          carryWeightLimit={10}
          canManageInventory={false}
          canEditInventory={false}
          canMoveInventory={false}
          canToggleEquipped={false}
          onSelectedItemIdChange={vi.fn()}
          onAddSelectedItem={vi.fn()}
          onQuantityChange={vi.fn()}
          onToggleEquipped={vi.fn()}
          onMoveInventoryItem={vi.fn()}
          onRemoveInventoryItem={vi.fn()}
        />
      );
    });

    expect(container.querySelectorAll("article.equipment-card--owned")).toHaveLength(1);
    const rootViewInside = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "View Inside"
    );
    await act(async () => rootViewInside?.click());

    let dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.textContent).toContain("Inside Magic Bag");
    expect(dialog?.textContent).toContain("Inner Pouch");
    expect(dialog?.textContent).not.toContain("Sword");

    const nestedViewInside = [...(dialog?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent === "View Inside"
    );
    await act(async () => nestedViewInside?.click());

    dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.textContent).toContain("Inside Inner Pouch");
    expect(dialog?.textContent).toContain("Magic Bag / Inner Pouch");
    expect(dialog?.textContent).toContain("Sword");
    const backButton = [...(dialog?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent === "Back"
    );
    await act(async () => backButton?.click());
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("Inside Magic Bag");

    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps View Inside available on dense container cards", () => {
    const bag: ItemDefinition = {
      id: "bag",
      name: "Magic Bag",
      interaction_type: "inventory_only",
      description: "",
      price: "",
      weight: 1,
      can_contain_items: true,
      storage_capacity_weight: 20,
      contents_weight_behavior: "ignored"
    };
    const markup = renderToStaticMarkup(
      <SheetEquipmentSection
        dense
        items={{ bag }}
        actionDefinitions={{}}
        attributeDefinitions={{}}
        proficiencyDefinitions={{}}
        augmentations={{}}
        itemOrder={["bag"]}
        selectedItemId=""
        selectedItem={null}
        equipment={[
          {
            relationship_id: "bag-entry",
            item_id: "bag",
            count: 1,
            equipped: false,
            current_contents_weight: 0
          }
        ]}
        currentCarriedWeight={1}
        carryWeightLimit={10}
        canManageInventory={false}
        canEditInventory={false}
        canMoveInventory={false}
        canToggleEquipped={false}
        onSelectedItemIdChange={vi.fn()}
        onAddSelectedItem={vi.fn()}
        onQuantityChange={vi.fn()}
        onToggleEquipped={vi.fn()}
        onMoveInventoryItem={vi.fn()}
        onRemoveInventoryItem={vi.fn()}
      />
    );

    expect(markup).toContain('aria-label="View inside Magic Bag"');
    expect(markup).toContain("equipment-card__view-inside");
  });

  it("moves a contained item through the destination dialog", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onMoveInventoryItem = vi.fn();
    const bag: ItemDefinition = {
      id: "bag",
      name: "Magic Bag",
      interaction_type: "inventory_only",
      description: "",
      price: "",
      weight: 1,
      can_contain_items: true,
      storage_capacity_weight: 20,
      contents_weight_behavior: "ignored"
    };

    await act(async () => {
      root.render(
        <SheetEquipmentSection
          items={{ bag, sword }}
          actionDefinitions={{}}
          attributeDefinitions={{}}
          proficiencyDefinitions={{}}
          augmentations={{}}
          itemOrder={["bag", "sword"]}
          selectedItemId=""
          selectedItem={null}
          equipment={[
            {
              relationship_id: "bag-entry",
              item_id: "bag",
              count: 1,
              equipped: false,
              current_contents_weight: 3
            },
            {
              relationship_id: "sword-entry",
              item_id: "sword",
              count: 1,
              equipped: false,
              parent_container_id: "bag-entry"
            }
          ]}
          currentCarriedWeight={1}
          carryWeightLimit={10}
          canManageInventory={false}
          canEditInventory={false}
          canMoveInventory
          canToggleEquipped={false}
          onSelectedItemIdChange={vi.fn()}
          onAddSelectedItem={vi.fn()}
          onQuantityChange={vi.fn()}
          onToggleEquipped={vi.fn()}
          onMoveInventoryItem={onMoveInventoryItem}
          onRemoveInventoryItem={vi.fn()}
        />
      );
    });

    const viewInside = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "View Inside"
    );
    await act(async () => viewInside?.click());

    const containerDialog = container.querySelector<HTMLElement>('[role="dialog"]');
    expect(containerDialog?.textContent).not.toContain("Move to Root Inventory");
    const openMoveDialog = containerDialog?.querySelector<HTMLButtonElement>(
      'button[aria-label="Move Sword"]'
    );
    await act(async () => openMoveDialog?.click());

    const dialogs = container.querySelectorAll<HTMLElement>('[role="dialog"]');
    const moveDialog = dialogs.item(dialogs.length - 1);
    expect(moveDialog.textContent).toContain("Move Sword");
    expect(moveDialog.textContent).toContain("Root Inventory");
    expect(moveDialog.textContent).toContain("Magic Bag");
    const currentContainer = [...moveDialog.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Magic Bag")
    );
    expect(currentContainer?.disabled).toBe(true);
    const moveToRoot = [...moveDialog.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Root Inventory")
    );
    await act(async () => moveToRoot?.click());

    expect(onMoveInventoryItem).toHaveBeenCalledWith("sword-entry", null);

    await act(async () => root.unmount());
    container.remove();
  });

  it("requires confirmation before removing an inventory entry", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const onRemoveInventoryItem = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    await act(async () => {
      root.render(
        <SheetEquipmentSection
          items={{ sword }}
          actionDefinitions={{}}
          attributeDefinitions={{}}
          proficiencyDefinitions={{}}
          augmentations={{}}
          itemOrder={["sword"]}
          selectedItemId=""
          selectedItem={null}
          equipment={[
            {
              relationship_id: "main_hand",
              item_id: "sword",
              count: 1,
              equipped: true
            }
          ]}
          currentCarriedWeight={1}
          carryWeightLimit={10}
          canManageInventory
          canEditInventory={false}
          canMoveInventory
          canToggleEquipped
          onSelectedItemIdChange={() => undefined}
          onAddSelectedItem={() => undefined}
          onQuantityChange={() => undefined}
          onToggleEquipped={() => undefined}
          onMoveInventoryItem={() => undefined}
          onRemoveInventoryItem={onRemoveInventoryItem}
        />
      );
    });

    const removeButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove Sword from inventory"]'
    );
    await act(async () => removeButton?.click());
    expect(onRemoveInventoryItem).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(
      "Remove “Sword”?\n\nThis removes the inventory entry and its quantity from the selected character. Nonempty storage containers are still protected by backend validation."
    );

    confirm.mockReturnValue(true);
    await act(async () => removeButton?.click());
    expect(onRemoveInventoryItem).toHaveBeenCalledWith("main_hand");

    await act(async () => root.unmount());
    confirm.mockRestore();
  });

  it("moves an inventory item when it is dropped onto storage", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const onMoveInventoryItem = vi.fn();
    const bag: ItemDefinition = {
      id: "bag",
      name: "Pack",
      interaction_type: "inventory_only",
      description: "",
      price: "",
      weight: 1,
      can_contain_items: true,
      storage_capacity_weight: 10
    };

    await act(async () => {
      root.render(
        <SheetEquipmentSection
          items={{ sword, bag }}
          actionDefinitions={{}}
          attributeDefinitions={{}}
          proficiencyDefinitions={{}}
          augmentations={{}}
          itemOrder={["bag", "sword"]}
          selectedItemId=""
          selectedItem={null}
          equipment={[
            {
              relationship_id: "bag-entry",
              item_id: "bag",
              count: 1,
              equipped: false
            },
            {
              relationship_id: "sword-entry",
              item_id: "sword",
              count: 1,
              equipped: false
            }
          ]}
          currentCarriedWeight={1}
          carryWeightLimit={10}
          canManageInventory
          canEditInventory={false}
          canMoveInventory
          canToggleEquipped
          onSelectedItemIdChange={() => undefined}
          onAddSelectedItem={() => undefined}
          onQuantityChange={() => undefined}
          onToggleEquipped={() => undefined}
          onMoveInventoryItem={onMoveInventoryItem}
          onRemoveInventoryItem={() => undefined}
        />
      );
    });

    const cards = [...container.querySelectorAll<HTMLElement>("article.equipment-card")];
    expect(container.querySelector(".inventory-root-drop-zone")).toBeNull();
    const bagCard = cards.find((card) => card.textContent?.includes("Pack"));
    const swordCard = cards.find((card) => card.textContent?.includes("Sword"));
    const data = new Map<string, string>();
    const dataTransfer = {
      dropEffect: "none",
      effectAllowed: "none",
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? ""
    };
    const dragStart = new Event("dragstart", { bubbles: true, cancelable: true });
    Object.defineProperty(dragStart, "dataTransfer", { value: dataTransfer });
    await act(async () => swordCard?.dispatchEvent(dragStart));

    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", { value: dataTransfer });
    await act(async () => bagCard?.dispatchEvent(drop));

    expect(onMoveInventoryItem).toHaveBeenCalledWith("sword-entry", "bag-entry");

    await act(async () => root.unmount());
  });
});
