from __future__ import annotations

from dataclasses import asdict
from typing import Any

from backend.state.models.fact import (
    ACTION_RANK_FACT_ID,
    ITEM_ATTRIBUTE_FACT_ID,
    ITEM_FLAT_EFFECT_BONUS_FACT_ID,
    ITEM_MANA_EFFICIENCY_FACT_ID,
    ITEM_MANA_REGENERATION_MODIFIER_FACT_ID,
    WEAPON_BASE_DAMAGE_FACT_ID,
    WEAPON_DAMAGE_TYPES_FACT_ID,
    WEAPON_GOVERNING_STAT_FACT_ID,
    WEAPON_PROFICIENCY_FACT_ID,
    WEAPON_PROFICIENCY_GROWTH_RATE_FACT_ID,
    WEAPON_REACH_FACT_ID,
    WEAPON_TYPE_FACT_ID,
)
from backend.state.models.stat import default_sheet_formula_stats

SHEET_ID = "dm_examples_sheet"
INSTANCE_ID = "dm_examples_instance"

ITEM_IDS = (
    "light_steps",
    "never_dulls",
    "fire_shard",
    "helm_of_sight",
    "pyromancy_robe",
    "sword_of_mana",
)

ACTION_IDS = (
    "parry_skill",
    "flames_of_life",
    "mana_manipulation",
)


def formula(
    text: str,
    *,
    aliases: list[dict[str, Any]] | None = None,
    tags: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "aliases": aliases,
        "text": text,
        "tags": [] if tags is None else tags,
    }


def fact_bridge(fact_id: str, value_type: str, value: Any) -> dict[str, Any]:
    return {
        "relationship_id": f"fixture_fact_{fact_id}",
        "fact_id": fact_id,
        "value": {"type": value_type, "value": value},
    }


def rank_fact(rank: str) -> dict[str, dict[str, Any]]:
    return {ACTION_RANK_FACT_ID: fact_bridge(ACTION_RANK_FACT_ID, "enum", rank)}


def selector(
    *required_tags: str,
    same_source_item: bool = False,
) -> dict[str, Any]:
    return {
        "required_tags": list(required_tags),
        "excluded_tags": [],
        "action_id": None,
        "formula_id": None,
        "step_id": None,
        "same_source_item": same_source_item,
    }


def augmentation(
    augmentation_id: str,
    name: str,
    *,
    root: str,
    path: list[str],
    effect: dict[str, Any],
    description: str = "",
) -> dict[str, Any]:
    return {
        "id": augmentation_id,
        "name": name,
        "description": description,
        "source": {"type": "item"},
        "scope": root,
        "target": {"root": root, "path": path},
        "effect": effect,
        "active": True,
        "applied": False,
        "applied_target_id": None,
        "lifecycle_owner": "equipment",
        "lifecycle": {
            "duration": None,
            "expires_at": None,
            "removal_condition": None,
        },
    }


def direct_effect(operation: str, value: str) -> dict[str, Any]:
    return {
        "type": "formula_modifier",
        "operation": operation,
        "value": formula(value),
        "selector": selector(),
    }


def evaluation_effect(
    operation: str,
    value: str,
    *required_tags: str,
    aliases: list[dict[str, Any]] | None = None,
    same_source_item: bool = False,
) -> dict[str, Any]:
    return {
        "type": "evaluation_formula_modifier",
        "operation": operation,
        "value": formula(value, aliases=aliases),
        "selector": selector(
            *required_tags,
            same_source_item=same_source_item,
        ),
    }


def roll_mode_effect(*required_tags: str) -> dict[str, Any]:
    return {
        "type": "roll_mode_modifier",
        "roll_mode": "advantage",
        "selector": selector(*required_tags),
    }


def weapon_facts(*, base_damage: int, name: str) -> dict[str, dict[str, Any]]:
    values = {
        WEAPON_TYPE_FACT_ID: ("text", "Sword"),
        WEAPON_BASE_DAMAGE_FACT_ID: ("number", base_damage),
        WEAPON_GOVERNING_STAT_FACT_ID: ("enum", "strength"),
        WEAPON_DAMAGE_TYPES_FACT_ID: ("list", ["Slashing"]),
        WEAPON_REACH_FACT_ID: ("number", 5),
        WEAPON_PROFICIENCY_FACT_ID: ("reference", "long_swords"),
        WEAPON_PROFICIENCY_GROWTH_RATE_FACT_ID: ("number", 0.01),
    }
    return {
        fact_id: {
            **fact_bridge(fact_id, value_type, value),
            "relationship_id": f"fixture_{name}_{fact_id}",
        }
        for fact_id, (value_type, value) in values.items()
    }


def item_payloads() -> list[dict[str, Any]]:
    sword_of_mana_facts = weapon_facts(base_damage=0, name="sword_of_mana")
    sword_of_mana_facts.update(
        {
            ITEM_MANA_EFFICIENCY_FACT_ID: fact_bridge(
                ITEM_MANA_EFFICIENCY_FACT_ID,
                "number",
                100,
            ),
            ITEM_FLAT_EFFECT_BONUS_FACT_ID: fact_bridge(
                ITEM_FLAT_EFFECT_BONUS_FACT_ID,
                "number",
                50,
            ),
            ITEM_MANA_REGENERATION_MODIFIER_FACT_ID: fact_bridge(
                ITEM_MANA_REGENERATION_MODIFIER_FACT_ID,
                "number",
                25,
            ),
        }
    )
    items = [
        {
            "id": "light_steps",
            "name": "Light Steps",
            "interaction_type": "equippable",
            "category": "Light Armor",
            "rank": "C+",
            "description": "Light armor that protects its wearer and aids stealth.",
            "price": "10,000 CP",
            "weight": "15 lbs",
            "facts": {},
            "fact_profile": None,
            "augmentation_templates": [
                augmentation(
                    "light_steps_resistance",
                    "Light Steps Resistance",
                    root="sheet",
                    path=["resistances", "resistance"],
                    effect=direct_effect("add", "0.10"),
                ),
                augmentation(
                    "light_steps_stealth",
                    "Light Steps Stealth Advantage",
                    root="instance",
                    path=["mana"],
                    effect=roll_mode_effect("check", "stealth"),
                ),
            ],
            "action_grants": [],
        },
        {
            "id": "never_dulls",
            "name": "Never Dulls",
            "interaction_type": "equippable",
            "category": "Sword",
            "rank": "D",
            "description": "Always remains sharp and never dulls.",
            "price": "500 CP",
            "weight": "3 lbs",
            "facts": weapon_facts(base_damage=15, name="never_dulls"),
            "fact_profile": "weapon",
            "augmentation_templates": [],
            "action_grants": [
                {
                    "action_id": "weapon_damage",
                    "availability": "equipped",
                    "consume_quantity": 0,
                },
                {
                    "action_id": "weapon_parry",
                    "availability": "equipped",
                    "consume_quantity": 0,
                },
            ],
        },
        {
            "id": "fire_shard",
            "name": "Fire Shard",
            "interaction_type": "equippable",
            "category": "Shard of Fire",
            "rank": "A",
            "description": "Grants the Fire attribute while equipped.",
            "price": "1,000,000 CP",
            "weight": "0.1 lbs",
            "facts": {
                ITEM_ATTRIBUTE_FACT_ID: fact_bridge(
                    ITEM_ATTRIBUTE_FACT_ID,
                    "text",
                    "Fire",
                )
            },
            "fact_profile": None,
            "augmentation_templates": [
                augmentation(
                    "fire_shard_damage",
                    "Fire Shard Damage",
                    root="instance",
                    path=["mana"],
                    effect=evaluation_effect("add", "10", "damage", "fire"),
                )
            ],
            "action_grants": [],
        },
        {
            "id": "helm_of_sight",
            "name": "Helm of Sight",
            "interaction_type": "equippable",
            "category": "Helmet",
            "rank": "C",
            "description": "Improves the wearer's perception.",
            "price": "5,000 CP",
            "weight": "2 lbs",
            "facts": {},
            "fact_profile": None,
            "augmentation_templates": [
                augmentation(
                    "helm_of_sight_perception",
                    "Helm of Sight Perception",
                    root="sheet",
                    path=["stats", "perception"],
                    effect=direct_effect("add", "2"),
                )
            ],
            "action_grants": [],
        },
        {
            "id": "pyromancy_robe",
            "name": "Pyromancy Robe",
            "interaction_type": "equippable",
            "category": "Armor",
            "rank": "B",
            "description": "Armor specialized against fire and magical damage.",
            "price": "100,000 CP",
            "weight": "1 lb",
            "facts": {},
            "fact_profile": None,
            "augmentation_templates": [
                augmentation(
                    "pyromancy_robe_fire",
                    "Pyromancy Robe Fire Resistance",
                    root="sheet",
                    path=["resistances", "fire"],
                    effect=direct_effect("add", "0.25"),
                ),
                augmentation(
                    "pyromancy_robe_magic",
                    "Pyromancy Robe Magic Resistance",
                    root="sheet",
                    path=["resistances", "magical"],
                    effect=direct_effect("add", "0.10"),
                ),
            ],
            "action_grants": [],
        },
        {
            "id": "sword_of_mana",
            "name": "Sword of Mana",
            "interaction_type": "equippable",
            "category": "Sword",
            "rank": "S",
            "description": "Conducts mana at 100% efficiency.",
            "price": "N/A",
            "weight": "3 lbs",
            "facts": sword_of_mana_facts,
            "fact_profile": "weapon",
            "augmentation_templates": [
                augmentation(
                    "sword_of_mana_effect_bonus",
                    "Sword of Mana Effect Bonus",
                    root="instance",
                    path=["mana"],
                    effect=evaluation_effect(
                        "add",
                        "@flat_effect_bonus",
                        "damage",
                        aliases=[
                            {
                                "name": "flat_effect_bonus",
                                "path": [
                                    "source_item",
                                    "facts",
                                    ITEM_FLAT_EFFECT_BONUS_FACT_ID,
                                ],
                            }
                        ],
                        same_source_item=True,
                    ),
                )
            ],
            "action_grants": [
                {
                    "action_id": "weapon_damage",
                    "availability": "equipped",
                    "consume_quantity": 0,
                }
            ],
        },
    ]
    for item in items:
        item.update(
            {
                "world_anvil_url": "",
                "gm_notes": "",
                "gm_special_properties": "",
            }
        )
    return items


def standalone_effect_payloads(
    *,
    mana_manipulation_effect_bonus: int,
) -> list[dict[str, Any]]:
    return [
        {
            "id": "parry_advantage",
            "name": "Parry Advantage",
            "description": "Always grants advantage on tagged Parry attempts.",
            "scope": "instance",
            "target": {"root": "instance", "path": ["mana"]},
            "effect": roll_mode_effect("check", "parry"),
            "active": True,
            "lifecycle": {},
        },
        {
            "id": "mana_manipulation_effect_bonus",
            "name": "Mana Manipulation Effect Bonus",
            "description": "A GM-configured bonus for tagged related effects.",
            "scope": "instance",
            "target": {"root": "instance", "path": ["mana"]},
            "effect": evaluation_effect(
                "add",
                str(mana_manipulation_effect_bonus),
                "mana_manipulation",
            ),
            "active": True,
            "lifecycle": {},
        },
        {
            "id": "mana_manipulation_overload_advantage",
            "name": "Mana Manipulation Overload Advantage",
            "description": "Grants advantage on tagged Overload checks.",
            "scope": "instance",
            "target": {"root": "instance", "path": ["mana"]},
            "effect": roll_mode_effect("check", "overload"),
            "active": True,
            "lifecycle": {},
        },
    ]


def action_payloads() -> list[dict[str, Any]]:
    return [
        {
            "id": "parry_skill",
            "name": "Parry",
            "roll_mode_kind": "none",
            "notes": (
                "Allows Parry attempts and explicitly activates their advantage. "
                "Proficiency improvements remain GM-managed."
            ),
            "facts": rank_fact("C"),
            "steps": [
                {
                    "step_id": "activate_parry_advantage",
                    "type": "apply_augmentation",
                    "target": "caster",
                    "augmentation_id": "parry_advantage",
                    "operation": "apply",
                }
            ],
        },
        {
            "id": "flames_of_life",
            "name": "Flames of Life",
            "roll_mode_kind": "none",
            "notes": (
                "Restores 10 health for 100 mana. Limb and injury restoration "
                "remain roleplay-only."
            ),
            "facts": rank_fact("S"),
            "steps": [
                {
                    "step_id": "spend_mana",
                    "type": "decrement_value",
                    "target": "caster",
                    "path": ["mana"],
                    "amount": formula("100"),
                    "min_value": formula("0"),
                    "max_value": None,
                    "on_min_violation": "reject",
                    "on_max_violation": "clamp",
                },
                {
                    "step_id": "restore_health",
                    "type": "increment_value",
                    "target": "caster",
                    "path": ["health"],
                    "amount": formula("10"),
                    "min_value": formula("0"),
                    "max_value": formula(
                        "@max_health",
                        aliases=[
                            {"name": "max_health", "path": ["stats", "health"]}
                        ],
                    ),
                    "on_min_violation": "clamp",
                    "on_max_violation": "clamp",
                },
            ],
        },
        {
            "id": "mana_manipulation",
            "name": "Mana Manipulation",
            "roll_mode_kind": "none",
            "notes": (
                "Maximum-mana and regeneration improvements require GM-authored "
                "values; timed regeneration remains manual."
            ),
            "facts": rank_fact("A"),
            "steps": [
                {
                    "step_id": "activate_mana_effect_bonus",
                    "type": "apply_augmentation",
                    "target": "caster",
                    "augmentation_id": "mana_manipulation_effect_bonus",
                    "operation": "apply",
                },
                {
                    "step_id": "activate_overload_advantage",
                    "type": "apply_augmentation",
                    "target": "caster",
                    "augmentation_id": "mana_manipulation_overload_advantage",
                    "operation": "apply",
                },
            ],
        },
        {
            "id": "fixture_fire_damage",
            "name": "Fixture Fire Damage",
            "roll_mode_kind": "damage",
            "notes": "Acceptance-only tagged formula.",
            "facts": {},
            "steps": [
                {
                    "step_id": "roll_fire_damage",
                    "type": "send_message",
                    "message": formula(
                        "Fire Damage: /r 1d6",
                        tags=["damage", "fire"],
                    ),
                }
            ],
        },
        {
            "id": "fixture_mana_overload",
            "name": "Fixture Mana Overload",
            "roll_mode_kind": "check",
            "notes": "Acceptance-only tagged formula.",
            "facts": {},
            "steps": [
                {
                    "step_id": "roll_mana_overload",
                    "type": "send_message",
                    "message": formula(
                        "Mana Overload: /r 1d100",
                        tags=["check", "overload", "mana_manipulation"],
                    ),
                }
            ],
        },
    ]


def sheet_payload() -> dict[str, Any]:
    formula_stats = {
        name: asdict(value) for name, value in default_sheet_formula_stats().items()
    }
    formula_stats["health"] = formula("100")
    formula_stats["mana"] = formula("200")
    items = {
        f"inventory_{item_id}": {
            "relationship_id": f"inventory_{item_id}",
            "count": 1,
            "equipped": True,
            "item_id": item_id,
        }
        for item_id in ITEM_IDS
    }
    actions = {
        f"assigned_{action_id}": {
            "relationship_id": f"assigned_{action_id}",
            "entry_id": action_id,
        }
        for action_id in (*ACTION_IDS, "fixture_fire_damage", "fixture_mana_overload")
    }
    return {
        "id": SHEET_ID,
        "name": "DM Examples Character",
        "notes": "Acceptance fixture for plan/active/dm_examples.md.",
        "dm_only": False,
        "xp_given_when_slayed": 0,
        "xp_cap": "",
        "proficiencies": {
            "fixture_long_swords": {
                "relationship_id": "fixture_long_swords",
                "prof_id": "long_swords",
                "use_count": 0,
                "growth_rate": 0.01,
            }
        },
        "items": items,
        "stats": {
            "strength": 10,
            "dexterity": 10,
            "constitution": 10,
            "perception": 10,
            "arcane": 10,
            "will": 10,
            **formula_stats,
        },
        "resistances": {},
        "slayed_record": {},
        "actions": actions,
        "facts": {},
    }


def authoring_requests(
    *,
    mana_manipulation_effect_bonus: int,
) -> list[dict[str, Any]]:
    requests: list[dict[str, Any]] = []
    requests.extend(
        {"type": "create_standalone_effect", "effect": effect}
        for effect in standalone_effect_payloads(
            mana_manipulation_effect_bonus=mana_manipulation_effect_bonus,
        )
    )
    requests.extend(
        {"type": "create_action", "action": action}
        for action in action_payloads()
    )
    requests.extend(
        {"type": "create_item", "item": item}
        for item in item_payloads()
    )
    requests.append({"type": "create_sheet", "sheet": sheet_payload()})
    requests.append(
        {
            "type": "create_instanced_sheet",
            "instance_id": INSTANCE_ID,
            "parent_sheet_id": SHEET_ID,
            "notes": "",
            "health": 50,
            "mana": 200,
            "resistances": {},
            "generate_access_code": False,
        }
    )
    return requests
