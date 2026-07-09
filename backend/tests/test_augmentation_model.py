from copy import deepcopy

import pytest

from backend.protocol.socket import normalize_server_event
from backend.state.models.augmentation import FormulaModifierSelector
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
            "relationship_id": None,
            "application_id": None,
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
                "tags": [],
            },
            "selector": {
                "required_tags": [],
                "excluded_tags": [],
                "action_id": None,
                "formula_id": None,
                "step_id": None,
                "same_source_item": False,
            },
        },
        "active": True,
        "applied": False,
        "applied_target_id": None,
        "lifecycle_owner": "manual",
        "lifecycle": {
            "mode": "manual",
            "remaining": None,
            "expires_at": None,
            "remove_when_source_inactive": False,
            "notes": "Remove when the item is unequipped.",
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
            "tags": [],
        },
        "selector": {
            "required_tags": [],
            "excluded_tags": [],
            "action_id": None,
            "formula_id": None,
            "step_id": None,
            "same_source_item": False,
        },
        "type": "formula_modifier",
    }


def test_formula_modifier_selector_defaults_for_legacy_effects() -> None:
    payload = _augmentation_payload()
    del payload["effect"]["selector"]

    state = State.from_dict({"augmentations": {"aug-1": payload}})

    assert state.augmentations["aug-1"].effect.selector == FormulaModifierSelector()


def test_formula_modifier_selector_matches_every_populated_constraint() -> None:
    selector = FormulaModifierSelector(
        required_tags=[" Damage ", "FIRE"],
        excluded_tags=["healing"],
        action_id="action-1",
        formula_id="formula-1",
        step_id="step-1",
        same_source_item=True,
    )

    assert selector.required_tags == ["damage", "fire"]
    assert selector.same_source_item is True
    assert selector.matches(
        tags=["fire", "damage", "critical"],
        action_id="action-1",
        formula_id="formula-1",
        step_id="step-1",
        source_item_relationship_id="sword-a",
        effect_source_item_relationship_id="sword-a",
    )
    assert not selector.matches(
        tags=["fire", "damage", "critical"],
        action_id="action-1",
        formula_id="formula-1",
        step_id="step-1",
    )
    assert not selector.matches(
        tags=["fire", "damage", "critical"],
        action_id="action-1",
        formula_id="formula-1",
        step_id="step-1",
        source_item_relationship_id="sword-a",
        effect_source_item_relationship_id="sword-b",
    )
    assert not selector.matches(
        tags=["damage"],
        action_id="action-1",
        formula_id="formula-1",
        step_id="step-1",
        source_item_relationship_id="sword-a",
        effect_source_item_relationship_id="sword-a",
    )
    assert not selector.matches(
        tags=["damage", "fire", "healing"],
        action_id="action-1",
        formula_id="formula-1",
        step_id="step-1",
        source_item_relationship_id="sword-a",
        effect_source_item_relationship_id="sword-a",
    )
    assert not selector.matches(
        tags=["damage", "fire"],
        action_id="other-action",
        formula_id="formula-1",
        step_id="step-1",
        source_item_relationship_id="sword-a",
        effect_source_item_relationship_id="sword-a",
    )
    assert not selector.matches(
        tags=["damage", "fire"],
        action_id="action-1",
        formula_id=None,
        step_id="step-1",
        source_item_relationship_id="sword-a",
        effect_source_item_relationship_id="sword-a",
    )
    assert not selector.matches(
        tags=["damage", "fire"],
        action_id="action-1",
        formula_id="formula-1",
        step_id="other-step",
        source_item_relationship_id="sword-a",
        effect_source_item_relationship_id="sword-a",
    )


def test_formula_modifier_selector_rejects_conflicting_tags() -> None:
    with pytest.raises(ValueError, match="both required and excluded: damage"):
        FormulaModifierSelector(
            required_tags=["damage"],
            excluded_tags=["DAMAGE"],
        )


@pytest.mark.parametrize(
    ("effect", "effect_type"),
    [
        (
            {
                "type": "evaluation_formula_modifier",
                "operation": "subtract",
                "value": {"aliases": None, "text": "2", "tags": []},
                "selector": {"required_tags": ["damage"]},
            },
            "evaluation_formula_modifier",
        ),
        (
            {
                "type": "roll_mode_modifier",
                "roll_mode": "advantage",
                "selector": {"required_tags": ["attack"]},
            },
            "roll_mode_modifier",
        ),
    ],
)
def test_state_round_trips_evaluation_time_effect_variants(
    effect: dict,
    effect_type: str,
) -> None:
    payload = _augmentation_payload()
    payload["effect"] = effect

    state = State.from_dict({"augmentations": {"aug-1": payload}})
    normalized_effect = state.to_dict()["augmentations"]["aug-1"]["effect"]

    assert state.augmentations["aug-1"].effect.type == effect_type
    assert normalized_effect["type"] == effect_type
    assert normalized_effect["selector"]["required_tags"] == effect["selector"][
        "required_tags"
    ]

    snapshot = deepcopy(payload)
    snapshot["effect"] = normalized_effect
    normalized = normalize_server_event(
        {
            "response_id": None,
            "state": {"augmentations": {"aug-1": snapshot}},
            "state_version": 1,
            "type": "state_snapshot",
            "request_id": None,
        }
    )
    assert normalized["state"]["augmentations"]["aug-1"]["effect"]["type"] == (
        effect_type
    )
