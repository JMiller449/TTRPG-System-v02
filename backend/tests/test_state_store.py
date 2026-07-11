import json
import os
from collections.abc import Iterator
from pathlib import Path

import pytest

from backend.state import store as store_module
from backend.state.migrations import (
    PersistedStateError,
    build_persisted_state,
    migrate_persisted_state,
)
from backend.state.models.access_code import SheetAccessCode
from backend.state.models.state import State
from backend.state.default_actions import seeded_global_action_payloads
from backend.state.store import CURRENT_STATE_SCHEMA_VERSION, StateSingleton


@pytest.fixture(autouse=True)
def isolate_state(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[Path]:
    original_state = StateSingleton._state
    state_path = tmp_path / "state.json"
    monkeypatch.setattr(store_module, "STATE_PATH", state_path)
    StateSingleton._state = State()
    try:
        yield state_path
    finally:
        StateSingleton._state = original_state


def _state_payload(*, action_name: str) -> dict:
    state = State.from_dict(
        {
            "actions": {
                action_name: {
                    "id": action_name,
                    "name": action_name.replace("_", " ").title(),
                    "steps": [],
                }
            }
        }
    )
    return state.to_dict(include_private=True)


def _checkpoint(payload: dict, *, schema_version: int = 1) -> dict:
    return {
        "schema_version": schema_version,
        "saved_at": "2026-06-27T12:00:00+00:00",
        "state": payload,
    }


def test_dump_writes_versioned_checkpoint_and_round_trips_state(isolate_state) -> None:
    state_path = isolate_state
    StateSingleton._state = State.from_dict(_state_payload(action_name="attack"))

    StateSingleton.dumpState()

    document = json.loads(state_path.read_text(encoding="utf-8"))
    assert document["schema_version"] == CURRENT_STATE_SCHEMA_VERSION
    assert document["saved_at"].endswith("+00:00")
    assert document["state"]["actions"]["attack"]["name"] == "Attack"

    StateSingleton._state = None
    loaded = StateSingleton.initializeState()
    assert loaded.actions["attack"].name == "Attack"


def test_fresh_state_seeds_weapon_family_proficiencies(isolate_state) -> None:
    StateSingleton._state = None

    loaded = StateSingleton.initializeState()

    assert {
        "long_swords",
        "short_swords",
        "spears",
        "shields",
        "pugilists",
        "staffs",
        "bows",
        "throwing",
        "knives",
        "axes",
    }.issubset(loaded.proficiencies)
    assert loaded.proficiencies["long_swords"].name == "Long Swords"
    assert loaded.proficiencies["long_swords"].category == "weapon_family"


def test_initialize_migrates_legacy_unversioned_state(isolate_state) -> None:
    state_path = isolate_state
    state_path.write_text(
        json.dumps(_state_payload(action_name="legacy_action")),
        encoding="utf-8",
    )
    StateSingleton._state = None

    loaded = StateSingleton.initializeState()

    assert loaded.actions["legacy_action"].name == "Legacy Action"


def test_v17_xp_migration_purges_legacy_kills_and_adds_registries() -> None:
    migrated = migrate_persisted_state(
        {
            "schema_version": 17,
            "state": {
                "sheets": {
                    "hero": {
                        "xp_cap": "100.555",
                        "xp_given_when_slayed": 0,
                        "slayed_record": {
                            "goblin": {"sheet_id": "goblin", "count": 4}
                        },
                    },
                    "goblin": {
                        "xp_cap": "A",
                        "xp_given_when_slayed": 25.555,
                        "slayed_record": {},
                    },
                }
            },
        }
    )

    assert migrated.state["parties"] == {}
    assert migrated.state["kill_registry"] == {}
    assert migrated.state["xp_adjustments"] == {}
    assert "slayed_record" not in migrated.state["sheets"]["hero"]
    assert migrated.state["sheets"]["hero"]["xp_cap"] == 100.56
    assert migrated.state["sheets"]["goblin"]["xp_cap"] == 0
    assert migrated.state["sheets"]["goblin"]["xp_given_when_slayed"] == 25.56


def test_v1_item_migration_preserves_text_and_replaces_active_equipment() -> None:
    migrated = migrate_persisted_state(
        {
            "schema_version": 1,
            "state": {
                "items": {
                    "sword": {
                        "id": "sword",
                        "name": "Sword",
                        "description": "Type: Longsword\nRank: B\nImmediate Effects: +2 fire damage",
                        "gm_notes": "Existing note",
                        "price": "10g",
                        "weight": "3",
                        "augmentation_templates": [],
                        "action_grants": [],
                    },
                    "potion": {
                        "id": "potion",
                        "name": "Potion",
                        "description": "Type: Consumable\nRank: F",
                        "price": "1g",
                        "weight": "1",
                        "augmentation_templates": [],
                        "action_grants": [
                            {
                                "action_id": "drink",
                                "availability": "carried",
                                "consume_quantity": 1,
                            }
                        ],
                    },
                },
                "sheets": {
                    "hero": {
                        "items": {
                            "sword_bridge": {
                                "relationship_id": "sword_bridge",
                                "item_id": "sword",
                                "count": 1,
                                "active": True,
                            }
                        }
                    }
                },
            },
        }
    )

    sword = migrated.state["items"]["sword"]
    potion = migrated.state["items"]["potion"]
    bridge = migrated.state["sheets"]["hero"]["items"]["sword_bridge"]
    assert sword["interaction_type"] == "equippable"
    assert sword["category"] == "Longsword"
    assert sword["rank"] == "B"
    assert sword["description"] == (
        "Immediate effect (legacy reference): +2 fire damage"
    )
    assert "Existing note" in sword["gm_notes"]
    assert "Review the interaction type" in sword["gm_notes"]
    assert potion["interaction_type"] == "consumable"
    assert bridge["equipped"] is True
    assert "active" not in bridge


def test_v3_item_migration_normalizes_descriptions_and_template_ownership() -> None:
    migrated = migrate_persisted_state(
        {
            "schema_version": 3,
            "state": {
                "items": {
                    "helm": {
                        "id": "helm",
                        "name": "Flame Helm",
                        "interaction_type": "equippable",
                        "category": "",
                        "rank": "",
                        "description": (
                            "Type: Helmet\nRank: A\n"
                            "Immediate Effects: +2 perception\n"
                            "Non-Immediate Effects: advantage on fire attacks"
                        ),
                        "augmentation_templates": [
                            {
                                "id": "effect-1",
                                "name": "Fire Sight",
                                "source": {"type": "manual"},
                                "scope": "instance",
                                "target": {
                                    "root": "instance",
                                    "path": ["health"],
                                },
                                "effect": {
                                    "type": "formula_modifier",
                                    "operation": "add",
                                    "value": {"aliases": None, "text": "2"},
                                },
                            }
                        ],
                    }
                }
            },
        }
    )

    helm = migrated.state["items"]["helm"]
    template = helm["augmentation_templates"][0]
    assert helm["category"] == "Helmet"
    assert helm["rank"] == "A"
    assert helm["description"] == (
        "Immediate effect (legacy reference): +2 perception\n"
        "Non-immediate effect (legacy reference): advantage on fire attacks"
    )
    assert template["source"] == {
        "type": "item",
        "id": "helm",
        "label": "Flame Helm",
        "relationship_id": None,
        "application_id": None,
    }
    assert template["lifecycle_owner"] == "equipment"
    assert template["applied"] is False
    assert template["applied_target_id"] is None


def test_v4_migration_groups_existing_condition_augmentations() -> None:
    migrated = migrate_persisted_state(
        {
            "schema_version": 4,
            "state": {
                "condition_presets": {
                    "poisoned": {
                        "id": "poisoned",
                        "name": "Poisoned",
                        "description": "Ongoing poison.",
                        "visibility": "gm_only",
                    }
                },
                "augmentations": {
                    "condition-child": {
                        "id": "condition-child",
                        "applied": True,
                        "applied_target_id": "instance-1",
                        "source": {
                            "type": "condition",
                            "id": "poisoned",
                            "label": "Poisoned",
                        },
                    }
                },
            },
        }
    )

    application_id = "condition:poisoned:instance-1"
    assert migrated.state["active_conditions"][application_id] == {
        "application_id": application_id,
        "condition_id": "poisoned",
        "condition_name": "Poisoned",
        "description": "Ongoing poison.",
        "visibility": "gm_only",
        "instance_id": "instance-1",
        "augmentation_ids": ["condition-child"],
    }
    assert migrated.state["augmentations"]["condition-child"]["source"][
        "application_id"
    ] == application_id


def test_v5_migration_initializes_standalone_effect_collections() -> None:
    migrated = migrate_persisted_state(
        {
            "schema_version": 5,
            "state": {
                "sheets": {},
                "standalone_effects": None,
                "standalone_effect_applications": [],
            },
        }
    )

    assert migrated.state["sheets"] == {}
    assert migrated.state["standalone_effects"] == {}
    assert migrated.state["standalone_effect_applications"] == {}


def test_v6_migration_backfills_required_sheet_attribute() -> None:
    migrated = migrate_persisted_state(
        {
            "schema_version": 6,
            "state": {
                "sheets": {
                    "mage": {
                        "id": "mage",
                    }
                }
            },
        }
    )

    definition = migrated.state["attributes"]["amount_of_reactions"]
    bridge = migrated.state["sheets"]["mage"]["attributes"]["amount_of_reactions"]
    assert definition["required"] is True
    assert definition["default_value"]["formula"]["text"] == (
        "@registration + @reaction_time"
    )
    assert bridge["relationship_id"] == "required_attribute_amount_of_reactions"


def test_v7_migration_adds_weapon_attribute_profile_metadata_without_inference() -> None:
    migrated = migrate_persisted_state(
        {
            "schema_version": 7,
            "state": {
                "attributes": {},
                "items": {
                    "sword": {
                        "id": "sword",
                        "name": "Sword",
                        "attributes": {},
                    }
                },
            },
        }
    )

    assert migrated.state["items"]["sword"]["attribute_profile"] is None
    assert migrated.state["items"]["sword"]["attributes"] == {}
    definition = migrated.state["attributes"]["weapon_proficiency"]
    assert definition["required"] is True
    assert definition["required_profile"] == "weapon"
    assert definition["reference_kind"] == "proficiency"


def test_v8_migration_adds_backend_owned_action_attribute_definitions() -> None:
    migrated = migrate_persisted_state(
        {
            "schema_version": 8,
            "state": {
                "attributes": {
                    "custom": {
                        "id": "custom",
                        "name": "Custom",
                        "subject_types": ["action"],
                        "value_type": "text",
                        "default_value": {"type": "text", "value": ""},
                    }
                },
                "actions": {"parry": {"id": "parry", "name": "Parry"}},
            },
        }
    )

    assert migrated.state["attributes"]["custom"]["backend_owned"] is False
    rank = migrated.state["attributes"]["action_rank"]
    assert rank["backend_owned"] is True
    assert rank["required"] is False
    assert rank["validation_options"][0] == "F"
    assert migrated.state["actions"]["parry"]["attributes"] == {}


def test_v15_migration_normalizes_weapon_actions_and_equipped_proficiencies() -> None:
    migrated = migrate_persisted_state(
        {
            "schema_version": 14,
            "state": {
                "proficiencies": {
                    "axes": {
                        "id": "axes",
                        "name": "Axes",
                        "description": "",
                        "category": "weapon_family",
                    }
                },
                "actions": {
                    "weapon_damage": {
                        "id": "weapon_damage",
                        "name": "Weapon Damage",
                        "steps": [
                            {
                                "step_id": "roll",
                                "type": "send_message",
                                "message": {
                                    "aliases": [
                                        {
                                            "name": "weapon_base_damage",
                                            "path": [
                                                "source_item",
                                                "facts",
                                                "weapon_base_damage",
                                            ],
                                        }
                                    ],
                                    "text": "@weapon_base_damage",
                                },
                            }
                        ],
                    }
                },
                "items": {
                    "axe": {
                        "id": "axe",
                        "name": "Axe",
                        "interaction_type": "equippable",
                        "description": "",
                        "price": "",
                        "weight": "",
                        "attribute_profile": "weapon",
                        "action_grants": [],
                        "attributes": {
                            "weapon_proficiency": {
                                "relationship_id": "weapon-prof",
                                "attribute_id": "weapon_proficiency",
                                "value": {"type": "reference", "value": "axes"},
                                "evaluated_value": "axes",
                            },
                            "weapon_proficiency_growth_rate": {
                                "relationship_id": "weapon-growth",
                                "attribute_id": "weapon_proficiency_growth_rate",
                                "value": {"type": "number", "value": 0.2},
                                "evaluated_value": 0.2,
                            },
                        },
                    }
                },
                "sheets": {
                    "hero": {
                        "actions": {
                            "stale-weapon": {
                                "relationship_id": "stale-weapon",
                                "entry_id": "weapon_damage",
                            },
                            "default_dodge": {
                                "relationship_id": "default_dodge",
                                "entry_id": "dodge",
                            },
                        },
                        "items": {
                            "axe-bridge": {
                                "relationship_id": "axe-bridge",
                                "item_id": "axe",
                                "count": 1,
                                "equipped": True,
                            }
                        },
                        "proficiencies": {},
                    }
                },
            },
        }
    )

    assert migrated.state["items"]["axe"]["action_grants"] == [
        {"action_id": "weapon_attack", "availability": "equipped", "consume_quantity": 0},
        {"action_id": "weapon_damage", "availability": "equipped", "consume_quantity": 0},
        {"action_id": "weapon_parry", "availability": "equipped", "consume_quantity": 0},
        {"action_id": "weapon_contest", "availability": "equipped", "consume_quantity": 0},
    ]
    assert migrated.state["sheets"]["hero"]["actions"] == {
        "default_dodge": {
            "relationship_id": "default_dodge",
            "entry_id": "dodge",
        }
    }
    assert migrated.state["actions"]["weapon_damage"]["steps"][0]["message"]["aliases"][0][
        "path"
    ] == ["source_item", "attributes", "weapon_base_damage"]
    assert migrated.state["sheets"]["hero"]["proficiencies"][
        "weapon_proficiency_axes"
    ] == {
        "relationship_id": "weapon_proficiency_axes",
        "prof_id": "axes",
        "use_count": 0,
        "growth_rate": 0.2,
    }


def test_v10_migration_adds_backend_owned_optional_sheet_attributes() -> None:
    migrated = migrate_persisted_state(
        {
            "schema_version": 10,
            "state": {
                "attributes": {
                    "custom": {
                        "id": "custom",
                        "name": "Custom",
                        "subject_types": ["sheet"],
                        "value_type": "text",
                        "default_value": {"type": "text", "value": "kept"},
                    }
                }
            },
        }
    )

    attributes = migrated.state["attributes"]
    assert attributes["custom"]["default_value"]["value"] == "kept"
    assert attributes["level"]["default_value"]["value"] == 1
    assert attributes["movement"]["default_value"]["value"] == 30
    assert attributes["movement"]["unit"] == "feet"
    assert attributes["mana_regeneration"]["default_value"]["value"] == 10
    assert attributes["mana_regeneration"]["unit"] == "% max mana per hour"
    assert all(
        attributes[attribute_id]["backend_owned"] is True
        and attributes[attribute_id]["required"] is False
        and attributes[attribute_id]["subject_types"] == ["sheet"]
        for attribute_id in ("level", "movement", "mana_regeneration")
    )


def test_v11_migration_adds_backend_owned_optional_item_attributes() -> None:
    migrated = migrate_persisted_state(
        {
            "schema_version": 11,
            "state": {
                "attributes": {
                    "custom": {
                        "id": "custom",
                        "name": "Custom",
                        "subject_types": ["item"],
                        "value_type": "text",
                        "default_value": {"type": "text", "value": "kept"},
                    }
                }
            },
        }
    )

    attributes = migrated.state["attributes"]
    assert attributes["custom"]["default_value"]["value"] == "kept"
    assert attributes["item_attribute"]["value_type"] == "text"
    assert attributes["item_attribute"]["default_value"]["value"] == ""
    assert attributes["item_mana_efficiency"]["default_value"]["value"] == 100
    assert attributes["item_mana_efficiency"]["unit"] == "%"
    assert attributes["item_flat_effect_bonus"]["default_value"]["value"] == 0
    assert attributes["item_flat_effect_bonus"]["unit"] == "bonus"
    assert attributes["item_mana_regeneration_modifier"]["default_value"]["value"] == 0
    assert attributes["item_mana_regeneration_modifier"]["unit"] == "%"
    assert all(
        attributes[attribute_id]["backend_owned"] is True
        and attributes[attribute_id]["required"] is False
        and attributes[attribute_id]["subject_types"] == ["item"]
        and attributes[attribute_id]["required_profile"] is None
        for attribute_id in (
            "item_attribute",
            "item_mana_efficiency",
            "item_flat_effect_bonus",
            "item_mana_regeneration_modifier",
        )
    )


def test_v12_migration_adds_proficiency_categories_and_weapon_families() -> None:
    migrated = migrate_persisted_state(
        {
            "schema_version": 12,
            "state": {
                "proficiencies": {
                    "custom_skill": {
                        "id": "custom_skill",
                        "name": "Custom Skill",
                        "description": "Kept.",
                    },
                    "long_swords": {
                        "id": "long_swords",
                        "name": "Renamed Long Blades",
                        "description": "GM edit preserved.",
                    },
                }
            },
        }
    )

    proficiencies = migrated.state["proficiencies"]
    assert proficiencies["custom_skill"]["category"] == "custom"
    assert proficiencies["long_swords"] == {
        "id": "long_swords",
        "name": "Renamed Long Blades",
        "description": "GM edit preserved.",
        "category": "weapon_family",
    }
    assert proficiencies["axes"]["name"] == "Axes"
    assert proficiencies["axes"]["category"] == "weapon_family"


def test_initialize_recovers_from_backup_when_primary_is_corrupt(
    isolate_state: Path,
) -> None:
    state_path = isolate_state
    backup_path = store_module._backup_path(state_path)
    state_path.write_text('{"schema_version": 1, "state":', encoding="utf-8")
    backup_path.write_text(
        json.dumps(_checkpoint(_state_payload(action_name="recovered_action"))),
        encoding="utf-8",
    )
    StateSingleton._state = None

    loaded = StateSingleton.initializeState()

    assert loaded.actions["recovered_action"].name == "Recovered Action"


def test_initialize_recovers_when_primary_has_invalid_state_shape(
    isolate_state: Path,
) -> None:
    state_path = isolate_state
    backup_path = store_module._backup_path(state_path)
    state_path.write_text(
        json.dumps(_checkpoint({"actions": []})),
        encoding="utf-8",
    )
    backup_path.write_text(
        json.dumps(_checkpoint(_state_payload(action_name="valid_backup"))),
        encoding="utf-8",
    )
    StateSingleton._state = None

    loaded = StateSingleton.initializeState()

    assert loaded.actions["valid_backup"].name == "Valid Backup"


def test_dump_rotates_only_valid_primary_checkpoint_to_backup(
    isolate_state: Path,
) -> None:
    state_path = isolate_state
    backup_path = store_module._backup_path(state_path)

    StateSingleton._state = State.from_dict(_state_payload(action_name="first"))
    StateSingleton.dumpState()
    StateSingleton._state = State.from_dict(_state_payload(action_name="second"))
    StateSingleton.dumpState()

    primary = json.loads(state_path.read_text(encoding="utf-8"))
    backup = json.loads(backup_path.read_text(encoding="utf-8"))
    assert set(primary["state"]["actions"]) == {"second"}
    assert set(backup["state"]["actions"]) == {"first"}

    state_path.write_text("not-json", encoding="utf-8")
    StateSingleton._state = State.from_dict(_state_payload(action_name="third"))
    StateSingleton.dumpState()

    backup = json.loads(backup_path.read_text(encoding="utf-8"))
    assert set(backup["state"]["actions"]) == {"first"}


def test_failed_primary_replace_leaves_recoverable_backup(
    isolate_state: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    state_path = isolate_state
    StateSingleton._state = State.from_dict(_state_payload(action_name="stable"))
    StateSingleton.dumpState()
    StateSingleton._state = State.from_dict(_state_payload(action_name="new"))

    real_replace = os.replace
    replace_count = 0

    def fail_second_replace(source: Path, destination: Path) -> None:
        nonlocal replace_count
        replace_count += 1
        if replace_count == 2:
            raise OSError("simulated interrupted checkpoint replacement")
        real_replace(source, destination)

    monkeypatch.setattr(store_module.os, "replace", fail_second_replace)

    with pytest.raises(OSError, match="simulated interrupted"):
        StateSingleton.dumpState()

    StateSingleton._state = None
    loaded = StateSingleton.initializeState()
    assert loaded.actions["stable"].name == "Stable"


def test_newer_primary_schema_falls_back_to_supported_backup(
    isolate_state: Path,
) -> None:
    state_path = isolate_state
    backup_path = store_module._backup_path(state_path)
    state_path.write_text(
        json.dumps(
            _checkpoint(
                _state_payload(action_name="future"),
                schema_version=CURRENT_STATE_SCHEMA_VERSION + 1,
            )
        ),
        encoding="utf-8",
    )
    backup_path.write_text(
        json.dumps(_checkpoint(_state_payload(action_name="supported"))),
        encoding="utf-8",
    )
    StateSingleton._state = None

    loaded = StateSingleton.initializeState()

    assert set(loaded.actions) == {
        "supported",
        *seeded_global_action_payloads(),
    }


def test_backup_migration_accepts_legacy_and_current_envelopes() -> None:
    legacy = migrate_persisted_state({"sheets": {}, "items": {}})
    current = migrate_persisted_state(build_persisted_state({"actions": {}}))

    assert legacy.source_version == 0
    assert legacy.migrated is True
    required_attribute = legacy.state.pop("attributes")
    seeded_actions = legacy.state.pop("actions")
    seeded_proficiencies = legacy.state.pop("proficiencies")
    assert required_attribute["amount_of_reactions"]["required"] is True
    assert seeded_actions == seeded_global_action_payloads()
    assert seeded_proficiencies["long_swords"]["category"] == "weapon_family"
    assert legacy.state == {
        "sheets": {},
        "items": {},
        "equipment_effect_projections": {},
        "active_conditions": {},
        "standalone_effects": {},
        "standalone_effect_applications": {},
        "parties": {},
        "kill_registry": {},
        "xp_adjustments": {},
    }
    assert current.source_version == CURRENT_STATE_SCHEMA_VERSION
    assert current.migrated is False
    assert current.state == {"actions": {}}


def test_v16_migration_moves_template_inventory_to_instances_and_rebases_effects() -> None:
    migrated = migrate_persisted_state(
        {
            "schema_version": 15,
            "state": {
                "sheets": {
                    "sheet-1": {
                        "items": {
                            "sword": {
                                "relationship_id": "sword",
                                "count": 1,
                                "equipped": True,
                                "item_id": "sword",
                            }
                        },
                        "stats": {"strength": 15},
                    }
                },
                "instanced_sheets": {
                    "instance-1": {"parent_id": "sheet-1", "augments": {"old": {"entry_id": "old"}}}
                },
                "augmentations": {"old": {"lifecycle_owner": "equipment"}},
                "equipment_effect_projections": {
                    "projection": {
                        "target_path": "/sheets/sheet-1/stats/strength",
                        "base_value": 10,
                        "effective_value": 15,
                    }
                },
            },
        }
    )

    assert migrated.state["sheets"]["sheet-1"]["stats"]["strength"] == 10
    instance = migrated.state["instanced_sheets"]["instance-1"]
    assert instance["stats"]["strength"] == 10
    assert instance["items"]["sword"]["equipped"] is True
    assert instance["augments"] == {}
    assert migrated.state["augmentations"] == {}
    assert migrated.state["equipment_effect_projections"] == {}


def test_v10_migration_replaces_only_old_generic_action_defaults() -> None:
    def old_action(action_id: str, stat_name: str) -> dict:
        label = action_id.title()
        return {
            "id": action_id,
            "name": label,
            "notes": "Default editable action preset. Old prototype default.",
            "steps": [
                {
                    "step_id": "roll",
                    "type": "send_message",
                    "message": {
                        "aliases": [
                            {"name": stat_name, "path": ["stats", stat_name]}
                        ],
                        "text": f"{label}: /r (1d100 / 100) * @{stat_name}",
                    },
                }
            ],
        }

    result = migrate_persisted_state(
        {
            "schema_version": 9,
            "state": {
                "actions": {
                    "attack": old_action("attack", "strength"),
                    "dodge": old_action("dodge", "dexterity"),
                    "parry": old_action("parry", "dexterity"),
                    "block": old_action("block", "constitution"),
                    "custom": {"id": "custom", "name": "Custom", "steps": []},
                },
                "sheets": {
                    "fighter": {
                        "actions": {
                            "default_attack": {
                                "relationship_id": "default_attack",
                                "entry_id": "attack",
                            },
                            "default_parry": {
                                "relationship_id": "default_parry",
                                "entry_id": "parry",
                            },
                            "custom": {
                                "relationship_id": "custom",
                                "entry_id": "custom",
                            },
                        }
                    }
                },
            },
        }
    )

    assert "attack" not in result.state["actions"]
    assert "parry" not in result.state["actions"]
    assert result.state["actions"]["block"]["steps"][0]["message"][
        "aliases"
    ] == [{"name": "strength", "path": ["sheet", "stats", "strength"]}]
    assert result.state["actions"]["custom"]["name"] == "Custom"
    assert set(result.state["sheets"]["fighter"]["actions"]) == {"custom"}


def test_backup_migration_rejects_invalid_and_future_envelopes() -> None:
    with pytest.raises(PersistedStateError, match="must be a JSON object"):
        migrate_persisted_state([])
    with pytest.raises(PersistedStateError, match="schema_version must be an integer"):
        migrate_persisted_state({"schema_version": "1", "state": {}})
    with pytest.raises(PersistedStateError, match="newer than supported"):
        migrate_persisted_state(
            {
                "schema_version": CURRENT_STATE_SCHEMA_VERSION + 1,
                "state": {},
            }
        )


def test_export_and_replace_state_preserve_private_data(isolate_state: Path) -> None:
    state_path = isolate_state
    state = StateSingleton.getState()
    state.sheet_access_codes["ACCESS-1"] = SheetAccessCode(
        code="ACCESS-1",
        sheet_id="sheet_1",
        instance_id="instance_1",
    )

    exported = StateSingleton.exportPersistedState()

    assert exported["schema_version"] == CURRENT_STATE_SCHEMA_VERSION
    assert exported["state"]["sheet_access_codes"]["ACCESS-1"] == {
        "active": True,
        "code": "ACCESS-1",
        "instance_id": "instance_1",
        "sheet_id": "sheet_1",
    }

    replacement = StateSingleton.getState()
    replacement.sheet_access_codes = {}
    StateSingleton.replaceState(replacement)

    persisted = json.loads(state_path.read_text(encoding="utf-8"))
    assert persisted["schema_version"] == CURRENT_STATE_SCHEMA_VERSION
    assert persisted["state"]["sheet_access_codes"] == {}
    assert not store_module._temporary_path(state_path).exists()
