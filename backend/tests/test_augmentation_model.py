from backend.protocol.socket import normalize_server_event
from backend.state.models.state import State


def _augmentation_payload() -> dict:
    return {
        "id": "aug-1",
        "name": "Flame Brand",
        "description": "Adds fire damage to weapon attacks.",
        "source": {
            "type": "item",
            "id": "flame_brand",
            "label": "Flame Brand",
        },
        "scope": "instance",
        "target": {
            "root": "instance",
            "path": ["weapon_damage_bonus"],
        },
        "effect": {
            "type": "formula_modifier",
            "operation": "add",
            "value": {
                "aliases": None,
                "text": "5",
            },
        },
        "active": True,
        "applied": False,
        "applied_target_id": None,
        "lifecycle": {
            "duration": None,
            "expires_at": None,
            "removal_condition": "Remove when the item is unequipped.",
        },
    }


def test_state_round_trips_top_level_augmentations() -> None:
    state = State.from_dict(
        {
            "augmentations": {
                "aug-1": _augmentation_payload(),
            }
        }
    )

    assert state.augmentations["aug-1"].source.type == "item"
    assert state.augmentations["aug-1"].target.path == ["weapon_damage_bonus"]
    assert state.augmentations["aug-1"].effect.operation == "add"

    assert state.to_dict()["augmentations"]["aug-1"] == _augmentation_payload()


def test_state_snapshot_protocol_accepts_augmentation_payload() -> None:
    normalized = normalize_server_event(
        {
            "response_id": None,
            "state": {
                "sheets": {},
                "instanced_sheets": {},
                "formulas": {},
                "actions": {},
                "items": {},
                "proficiencies": {},
                "augmentations": {
                    "aug-1": _augmentation_payload(),
                },
            },
            "state_version": 7,
            "type": "state_snapshot",
            "request_id": "req-1",
        }
    )

    assert normalized["state"]["augmentations"]["aug-1"]["effect"] == {
        "operation": "add",
        "value": {
            "aliases": None,
            "text": "5",
        },
        "type": "formula_modifier",
    }
