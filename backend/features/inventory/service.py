from __future__ import annotations

from collections.abc import Mapping

from backend.state.models.item import Item, ItemBridge


def _children_by_parent(
    inventory: Mapping[str, ItemBridge],
) -> dict[str, list[str]]:
    children: dict[str, list[str]] = {}
    for relationship_id, bridge in inventory.items():
        parent_id = bridge.parent_container_id
        if parent_id in inventory and parent_id != relationship_id:
            children.setdefault(parent_id, []).append(relationship_id)
    return children


def calculate_container_contents_weights(
    inventory: Mapping[str, ItemBridge],
    item_definitions: Mapping[str, Item],
) -> dict[str, float]:
    """Project each container's effective stored weight in pounds.

    A nested weight-negating container contributes only its own weight to its
    parent. Its own capacity still measures the effective weight of the entries
    stored directly inside it.
    """

    children = _children_by_parent(inventory)

    def contribution(relationship_id: str, active: set[str]) -> float:
        if relationship_id in active:
            return 0.0
        bridge = inventory.get(relationship_id)
        if bridge is None:
            return 0.0
        definition = item_definitions.get(bridge.item_id)
        if definition is None:
            return 0.0
        next_active = {*active, relationship_id}
        own_weight = definition.weight * bridge.count
        if (
            definition.can_contain_items
            and definition.contents_weight_behavior == "ignored"
        ):
            return own_weight
        return own_weight + sum(
            contribution(child_id, next_active)
            for child_id in children.get(relationship_id, [])
        )

    projected: dict[str, float] = {}
    for relationship_id, bridge in inventory.items():
        definition = item_definitions.get(bridge.item_id)
        if definition is None or not definition.can_contain_items:
            continue
        projected[relationship_id] = round(
            sum(
                contribution(child_id, {relationship_id})
                for child_id in children.get(relationship_id, [])
            ),
            10,
        )
    return projected


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

    contents_weights = calculate_container_contents_weights(
        inventory,
        item_definitions,
    )
    for relationship_id, contents_weight in contents_weights.items():
        bridge = inventory[relationship_id]
        definition = item_definitions[bridge.item_id]
        capacity = definition.storage_capacity_weight
        if capacity is not None and contents_weight > capacity + 1e-9:
            raise ValueError(
                f"Storage container '{definition.name}' is over capacity: "
                f"{contents_weight:g} lb stored exceeds its {capacity:g} lb limit."
            )


def calculate_carried_weight(
    inventory: Mapping[str, ItemBridge],
    item_definitions: Mapping[str, Item],
) -> float:
    """Calculate weight in pounds with containment and cycle protection."""

    children_by_parent = _children_by_parent(inventory)

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
