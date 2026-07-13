from __future__ import annotations

from collections.abc import Mapping

from backend.state.models.item import Item, ItemBridge


def validate_inventory(
    inventory: Mapping[str, ItemBridge],
    item_definitions: Mapping[str, Item],
) -> None:
    """Validate one sheet's complete inventory containment graph."""

    children_by_parent: dict[str, list[str]] = {}
    for relationship_id, bridge in inventory.items():
        if relationship_id != bridge.relationship_id:
            raise ValueError(
                f"Inventory key '{relationship_id}' must match relationship_id "
                f"'{bridge.relationship_id}'."
            )
        if bridge.item_id not in item_definitions:
            raise ValueError(f"Item '{bridge.item_id}' does not exist.")
        if bridge.count < 0:
            raise ValueError("Inventory quantity must not be negative.")

        parent_id = bridge.parent_container_id
        if parent_id is None:
            continue
        if parent_id == relationship_id:
            raise ValueError("An inventory entry cannot contain itself.")
        parent = inventory.get(parent_id)
        if parent is None:
            raise ValueError(f"Container inventory entry '{parent_id}' does not exist.")
        parent_definition = item_definitions.get(parent.item_id)
        if parent_definition is None or not parent_definition.can_contain_items:
            raise ValueError(f"Inventory entry '{parent_id}' is not a storage container.")
        if parent.count != 1:
            raise ValueError(
                "A storage container must have quantity 1 before it can hold items."
            )
        if bridge.equipped:
            raise ValueError("Unequip an item before moving it into storage.")
        children_by_parent.setdefault(parent_id, []).append(relationship_id)

    for container_id in children_by_parent:
        if inventory[container_id].count != 1:
            raise ValueError(
                "A storage container holding items must have quantity 1."
            )

    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(relationship_id: str) -> None:
        if relationship_id in visiting:
            raise ValueError("Inventory containment cycles are not allowed.")
        if relationship_id in visited:
            return
        visiting.add(relationship_id)
        for child_id in children_by_parent.get(relationship_id, []):
            visit(child_id)
        visiting.remove(relationship_id)
        visited.add(relationship_id)

    for relationship_id in inventory:
        visit(relationship_id)


def calculate_carried_weight(
    inventory: Mapping[str, ItemBridge],
    item_definitions: Mapping[str, Item],
) -> float:
    """Calculate weight in pounds with containment and cycle protection."""

    children_by_parent: dict[str, list[str]] = {}
    for relationship_id, bridge in inventory.items():
        parent_id = bridge.parent_container_id
        if parent_id in inventory and parent_id != relationship_id:
            children_by_parent.setdefault(parent_id, []).append(relationship_id)

    counted: set[str] = set()

    def contribution(relationship_id: str, active: set[str]) -> float:
        if relationship_id in counted or relationship_id in active:
            return 0.0
        bridge = inventory.get(relationship_id)
        if bridge is None:
            return 0.0
        counted.add(relationship_id)
        active.add(relationship_id)
        definition = item_definitions.get(bridge.item_id)
        own_weight = 0.0 if definition is None else definition.weight * bridge.count
        descendants = 0.0
        ignores_contents = (
            definition is not None
            and definition.can_contain_items
            and definition.contents_weight_behavior == "ignored"
        )
        if not ignores_contents:
            descendants = sum(
                contribution(child_id, active)
                for child_id in children_by_parent.get(relationship_id, [])
            )
        else:
            # Mark ignored descendants as visited so malformed graphs cannot make them
            # reappear as independent roots later in this calculation.
            for child_id in children_by_parent.get(relationship_id, []):
                mark_ignored(child_id, active)
        active.remove(relationship_id)
        return own_weight + descendants

    def mark_ignored(relationship_id: str, active: set[str]) -> None:
        if relationship_id in counted or relationship_id in active:
            return
        counted.add(relationship_id)
        active.add(relationship_id)
        for child_id in children_by_parent.get(relationship_id, []):
            mark_ignored(child_id, active)
        active.remove(relationship_id)

    roots = [
        relationship_id
        for relationship_id, bridge in inventory.items()
        if bridge.parent_container_id not in inventory
        or bridge.parent_container_id == relationship_id
    ]
    total = sum(contribution(relationship_id, set()) for relationship_id in roots)
    # Invalid legacy cycles have no root. Count each remaining entry at most once.
    total += sum(
        contribution(relationship_id, set())
        for relationship_id in inventory
        if relationship_id not in counted
    )
    return round(total, 10)
