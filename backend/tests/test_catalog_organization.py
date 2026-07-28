import asyncio
from copy import deepcopy

import pytest

from backend.features.catalog_organization.schema import (
    CreateCatalogFolder,
    DeleteCatalogFolder,
    MoveCatalogNode,
    RenameCatalogFolder,
)
from backend.features.catalog_organization.service import (
    create_catalog_folder,
    delete_catalog_folder,
    move_catalog_node,
)
from backend.features.state_sync.schema import PatchOp
from backend.features.state_sync.service import build_state_patch, state_sync_service
from backend.state.models.action import Action
from backend.state.models.item import Item
from backend.state.store import DEFAULT_STATE, StateSingleton


def _request(model, **values):
    type_name = {
        CreateCatalogFolder: "create_catalog_folder",
        DeleteCatalogFolder: "delete_catalog_folder",
        MoveCatalogNode: "move_catalog_node",
        RenameCatalogFolder: "rename_catalog_folder",
    }[model]
    return model.model_validate(
        {
            **values,
            "request_id": (
                f"request-{type_name}-"
                f"{values.get('folder_id', values.get('node_id', 'catalog'))}-"
                f"{values.get('parent_id', 'root')}"
            ),
            "type": type_name,
        }
    )


@pytest.mark.parametrize(
    ("model", "values"),
    (
        (
            CreateCatalogFolder,
            {
                "folder_id": "folder",
                "catalog": "items",
                "name": "   ",
                "parent_id": None,
            },
        ),
        (
            RenameCatalogFolder,
            {
                "folder_id": "folder",
                "name": "   ",
            },
        ),
        (
            MoveCatalogNode,
            {
                "catalog": "items",
                "node_type": "entry",
                "node_id": "   ",
                "parent_id": None,
            },
        ),
        (DeleteCatalogFolder, {"folder_id": "   "}),
    ),
)
def test_catalog_requests_reject_whitespace_only_required_text(
    model, values: dict
) -> None:
    with pytest.raises(ValueError, match="Value cannot be blank"):
        _request(model, **values)


def test_catalog_folders_nest_and_entries_move_without_changing_domain_entities() -> None:
    state = deepcopy(DEFAULT_STATE)
    state.actions["slash"] = Action(id="slash", name="Slash")
    StateSingleton._state = state

    asyncio.run(
        create_catalog_folder(
            _request(
                CreateCatalogFolder,
                folder_id="combat",
                catalog="actions",
                name="Combat",
                parent_id=None,
            )
        )
    )
    asyncio.run(
        create_catalog_folder(
            _request(
                CreateCatalogFolder,
                folder_id="reactions",
                catalog="actions",
                name="Reactions",
                parent_id="combat",
            )
        )
    )
    asyncio.run(
        move_catalog_node(
            _request(
                MoveCatalogNode,
                catalog="actions",
                node_type="entry",
                node_id="slash",
                parent_id="reactions",
                position=0,
            )
        )
    )

    updated = StateSingleton.getState()
    assert updated.actions["slash"].name == "Slash"
    assert updated.catalog_folders["reactions"].parent_id == "combat"
    assert updated.catalog_entries["actions:slash"].folder_id == "reactions"


def test_catalog_folder_move_rejects_cycles_and_cross_catalog_parents() -> None:
    state = deepcopy(DEFAULT_STATE)
    StateSingleton._state = state
    asyncio.run(
        create_catalog_folder(
            _request(
                CreateCatalogFolder,
                folder_id="parent",
                catalog="items",
                name="Parent",
                parent_id=None,
            )
        )
    )
    asyncio.run(
        create_catalog_folder(
            _request(
                CreateCatalogFolder,
                folder_id="child",
                catalog="items",
                name="Child",
                parent_id="parent",
            )
        )
    )
    asyncio.run(
        create_catalog_folder(
            _request(
                CreateCatalogFolder,
                folder_id="actions",
                catalog="actions",
                name="Actions",
                parent_id=None,
            )
        )
    )

    with pytest.raises(ValueError, match="cannot contain itself"):
        asyncio.run(
            move_catalog_node(
                _request(
                    MoveCatalogNode,
                    catalog="items",
                    node_type="folder",
                    node_id="parent",
                    parent_id="child",
                    position=None,
                )
            )
        )
    with pytest.raises(ValueError, match="cross catalog boundaries"):
        asyncio.run(
            move_catalog_node(
                _request(
                    MoveCatalogNode,
                    catalog="items",
                    node_type="folder",
                    node_id="child",
                    parent_id="actions",
                    position=None,
                )
            )
        )


def test_deleting_folder_preserves_entries_and_child_folders_at_parent() -> None:
    state = deepcopy(DEFAULT_STATE)
    state.actions["slash"] = Action(id="slash", name="Slash")
    StateSingleton._state = state
    for folder_id, name, parent_id in (
        ("combat", "Combat", None),
        ("reactions", "Reactions", "combat"),
    ):
        asyncio.run(
            create_catalog_folder(
                _request(
                    CreateCatalogFolder,
                    folder_id=folder_id,
                    catalog="actions",
                    name=name,
                    parent_id=parent_id,
                )
            )
        )
    asyncio.run(
        move_catalog_node(
            _request(
                MoveCatalogNode,
                catalog="actions",
                node_type="entry",
                node_id="slash",
                parent_id="combat",
                position=None,
            )
        )
    )

    asyncio.run(
        delete_catalog_folder(
            _request(DeleteCatalogFolder, folder_id="combat")
        )
    )

    updated = StateSingleton.getState()
    assert "combat" not in updated.catalog_folders
    assert updated.catalog_folders["reactions"].parent_id is None
    assert updated.catalog_entries["actions:slash"].folder_id is None
    assert "slash" in updated.actions


def test_player_snapshots_receive_only_visible_catalog_branches() -> None:
    state = deepcopy(DEFAULT_STATE)
    state.actions["slash"] = Action(id="slash", name="Slash")
    StateSingleton._state = state
    asyncio.run(
        create_catalog_folder(
            _request(
                CreateCatalogFolder,
                folder_id="combat",
                catalog="actions",
                name="Combat",
                parent_id=None,
            )
        )
    )
    asyncio.run(
        create_catalog_folder(
            _request(
                CreateCatalogFolder,
                folder_id="unused",
                catalog="actions",
                name="Unused",
                parent_id=None,
            )
        )
    )
    asyncio.run(
        move_catalog_node(
            _request(
                MoveCatalogNode,
                catalog="actions",
                node_type="entry",
                node_id="slash",
                parent_id="combat",
                position=0,
            )
        )
    )

    player = asyncio.run(state_sync_service.snapshot(role="player"))
    dm = asyncio.run(state_sync_service.snapshot(role="dm"))

    assert player.state["catalog_folders"]["combat"]["name"] == "Combat"
    assert player.state["catalog_entries"]["actions:slash"]["folder_id"] == "combat"
    assert "unused" not in player.state["catalog_folders"]
    assert dm.state["catalog_folders"]["combat"]["name"] == "Combat"
    assert dm.state["catalog_folders"]["unused"]["name"] == "Unused"

    projected_patch = state_sync_service._redact_patch_for_role(
        build_state_patch(
            [
                PatchOp(op="set", path="/catalog_folders", value={}),
                PatchOp(op="set", path="/catalog_entries", value={}),
            ],
            state_version=1,
        ),
        role="player",
    )
    assert projected_patch.ops[0].value == player.state["catalog_folders"]
    assert projected_patch.ops[1].value == player.state["catalog_entries"]


def test_item_visibility_patch_refreshes_player_catalog_projection() -> None:
    state = deepcopy(DEFAULT_STATE)
    state.items["sword"] = Item.from_dict(
        {
            "id": "sword",
            "name": "Sword",
            "interaction_type": "inventory_only",
            "description": "",
            "price": "",
            "weight": 1,
            "augmentation_templates": [],
            "player_catalog_access": {
                "mode": "all",
                "instance_ids": [],
            },
        }
    )
    StateSingleton._state = state
    asyncio.run(
        create_catalog_folder(
            _request(
                CreateCatalogFolder,
                folder_id="weapons",
                catalog="items",
                name="Weapons",
                parent_id=None,
            )
        )
    )
    asyncio.run(
        move_catalog_node(
            _request(
                MoveCatalogNode,
                catalog="items",
                node_type="entry",
                node_id="sword",
                parent_id="weapons",
                position=0,
            )
        )
    )

    patch = state_sync_service._redact_patch_for_role(
        build_state_patch(
            [
                PatchOp(
                    op="set",
                    path="/items/sword",
                    value=state.items["sword"],
                )
            ],
            state_version=1,
        ),
        role="player",
    )

    assert [op.path for op in patch.ops] == [
        "/items/sword",
        "/catalog_folders",
        "/catalog_entries",
    ]
    assert patch.ops[1].value["weapons"]["name"] == "Weapons"
    assert patch.ops[2].value["items:sword"]["folder_id"] == "weapons"
