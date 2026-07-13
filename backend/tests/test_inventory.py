import pytest

from backend.features.inventory.service import calculate_carried_weight, validate_inventory
from backend.state.models.item import Item, ItemBridge


def item(
    item_id: str,
    weight: float,
    *,
    container: bool = False,
    ignored: bool = False,
) -> Item:
    return Item.from_dict(
        {
            "id": item_id,
            "name": item_id.replace("_", " ").title(),
            "interaction_type": "inventory_only",
            "description": "",
            "price": "",
            "weight": weight,
            "can_contain_items": container,
            "contents_weight_behavior": "ignored" if ignored else "normal",
        }
    )


def bridge(
    relationship_id: str,
    item_id: str,
    count: int = 1,
    *,
    parent: str | None = None,
    equipped: bool = False,
) -> ItemBridge:
    return ItemBridge(
        relationship_id=relationship_id,
        item_id=item_id,
        count=count,
        equipped=equipped,
        parent_container_id=parent,
    )


def test_carried_weight_counts_quantities_equipped_items_and_normal_storage() -> None:
    definitions = {
        "bag": item("bag", 2, container=True),
        "sword": item("sword", 3),
        "stone": item("stone", 0.5),
    }
    inventory = {
        "bag": bridge("bag", "bag"),
        "sword": bridge("sword", "sword", 2, parent="bag", equipped=False),
        "stone": bridge("stone", "stone", 4, equipped=True),
        "empty": bridge("empty", "stone", 0),
    }

    validate_inventory(inventory, definitions)
    assert calculate_carried_weight(inventory, definitions) == 10


def test_weight_negating_storage_counts_only_the_bag_and_restores_at_root() -> None:
    definitions = {
        "bag": item("bag", 2, container=True, ignored=True),
        "chest": item("chest", 4, container=True, ignored=True),
        "sword": item("sword", 3),
    }
    inventory = {
        "bag": bridge("bag", "bag"),
        "chest": bridge("chest", "chest", parent="bag"),
        "sword": bridge("sword", "sword", 2, parent="chest"),
    }

    assert calculate_carried_weight(inventory, definitions) == 2
    inventory["sword"].parent_container_id = None
    assert calculate_carried_weight(inventory, definitions) == 8


@pytest.mark.parametrize(
    ("inventory", "message"),
    [
        ({"bag": bridge("bag", "bag", parent="bag")}, "cannot contain itself"),
        (
            {
                "bag": bridge("bag", "bag", parent="chest"),
                "chest": bridge("chest", "chest", parent="bag"),
            },
            "cycles",
        ),
        (
            {
                "bag": bridge("bag", "bag"),
                "sword": bridge("sword", "sword", parent="missing"),
            },
            "does not exist",
        ),
        (
            {
                "sword": bridge("sword", "sword"),
                "gem": bridge("gem", "sword", parent="sword"),
            },
            "not a storage container",
        ),
        (
            {
                "bag": bridge("bag", "bag", count=2),
                "sword": bridge("sword", "sword", parent="bag"),
            },
            "quantity 1",
        ),
        (
            {
                "bag": bridge("bag", "bag"),
                "sword": bridge("sword", "sword", parent="bag", equipped=True),
            },
            "Unequip",
        ),
    ],
)
def test_invalid_containment_is_rejected(
    inventory: dict[str, ItemBridge],
    message: str,
) -> None:
    definitions = {
        "bag": item("bag", 2, container=True),
        "chest": item("chest", 4, container=True),
        "sword": item("sword", 3),
    }
    with pytest.raises(ValueError, match=message):
        validate_inventory(inventory, definitions)


def test_calculator_cycle_protection_is_deterministic_for_malformed_legacy_data() -> None:
    definitions = {
        "bag": item("bag", 2, container=True),
        "chest": item("chest", 4, container=True),
    }
    inventory = {
        "bag": bridge("bag", "bag", parent="chest"),
        "chest": bridge("chest", "chest", parent="bag"),
    }
    assert calculate_carried_weight(inventory, definitions) == 6
