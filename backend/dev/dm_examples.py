"""Reusable starter-campaign content for development and acceptance tests."""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from backend.state.models.attribute import (
    ACTION_BASE_SPELL_DAMAGE_ATTRIBUTE_ID,
    ACTION_MANA_COST_ATTRIBUTE_ID,
    ACTION_PROFICIENCY_ATTRIBUTE_ID,
    ACTION_RANK_ATTRIBUTE_ID,
    ITEM_ATTRIBUTE_ATTRIBUTE_ID,
    ITEM_FLAT_EFFECT_BONUS_ATTRIBUTE_ID,
    ITEM_MANA_EFFICIENCY_ATTRIBUTE_ID,
    ITEM_MANA_REGENERATION_MODIFIER_ATTRIBUTE_ID,
    WEAPON_BASE_DAMAGE_ATTRIBUTE_ID,
    WEAPON_DAMAGE_TYPES_ATTRIBUTE_ID,
    WEAPON_GOVERNING_STAT_ATTRIBUTE_ID,
    WEAPON_PROFICIENCY_ATTRIBUTE_ID,
    WEAPON_PROFICIENCY_GROWTH_RATE_ATTRIBUTE_ID,
    WEAPON_REACH_ATTRIBUTE_ID,
    WEAPON_TYPE_ATTRIBUTE_ID,
)
from backend.state.models.stat import default_sheet_formula_stats

SHEET_ID = "dm_examples_sheet"
INSTANCE_ID = "dm_examples_instance"
SHADOWBLADE_SHEET_ID = "starter_shadowblade_template"
SHADOWBLADE_INSTANCE_ID = "starter_shadowblade_instance"
GOBLIN_SHEET_ID = "starter_red_gate_goblin"
WRAITH_SHEET_ID = "starter_ash_wraith"

PLAYER_TEMPLATE_IDS = (SHEET_ID, SHADOWBLADE_SHEET_ID)
ENEMY_TEMPLATE_IDS = (GOBLIN_SHEET_ID, WRAITH_SHEET_ID)
ENCOUNTER_IDS = ("red_gate_scouts", "ash_wraith_threshold")

ITEM_IDS = (
    "light_steps",
    "never_dulls",
    "fire_shard",
    "helm_of_sight",
    "pyromancy_robe",
    "sword_of_mana",
)
STARTER_ITEM_IDS = (
    *ITEM_IDS,
    "night_fang",
    "lesser_mana_vial",
    "emberleaf_poultice",
    "hunter_license",
    "black_gate_core",
)

ACTION_IDS = (
    "parry_skill",
    "flames_of_life",
    "mana_manipulation",
)
STARTER_ACTION_IDS = (
    *ACTION_IDS,
    "ember_bolt_to_hit",
    "ember_bolt_damage",
    "shadow_step",
    "lesser_mana_vial_drink",
    "emberleaf_poultice_apply",
    "apply_shadow_bound",
    "remove_shadow_bound",
    "apply_bleeding",
    "gate_lore_check",
    "train_shadow_steps",
    "red_gate_claw",
    "ash_wraith_spark",
)

CAMPAIGN_ATTRIBUTE_IDS = (
    "campaign_role",
    "gate_affinity",
    "guild_rank",
)

CUSTOM_PROFICIENCY_IDS = (
    "pyromancy",
    "shadow_steps",
    "gate_lore",
)

CONDITION_IDS = (
    "shadow_bound",
    "bleeding",
    "arcane_surge",
    "hidden_gate_mark",
)
FORMULA_IDS = (
    "flames_of_life_mana_cost",
    "flames_of_life_healing",
    "ember_bolt_attack_roll",
    "ember_bolt_damage_roll",
    "gate_lore_roll",
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


def formula_reference(formula_id: str) -> dict[str, str]:
    return {
        "type": "formula_reference",
        "formula_id": formula_id,
    }


def formula_payloads() -> list[dict[str, Any]]:
    return [
        {
            "id": "flames_of_life_mana_cost",
            "formula": formula("100", tags=["resource", "mana", "cost"]),
        },
        {
            "id": "flames_of_life_healing",
            "formula": formula("10", tags=["healing", "health"]),
        },
        {
            "id": "ember_bolt_attack_roll",
            "formula": formula(
                (
                    "Ember Bolt To-Hit: /r floor((1 + @spell_proficiency) "
                    "* (1d100 / 100) * @arcane)"
                ),
                aliases=[
                    {
                        "name": "spell_proficiency",
                        "path": [
                            "action",
                            "resolved",
                            "proficiency_modifier",
                        ],
                    },
                    {"name": "arcane", "path": ["stats", "arcane"]},
                ],
                tags=["check", "spell", "attack", "fire"],
            ),
        },
        {
            "id": "ember_bolt_damage_roll",
            "formula": formula(
                (
                    "Ember Bolt Damage: /r floor((1 + @spell_proficiency) "
                    "* (1d100 / 100) * @arcane + @base_damage)"
                ),
                aliases=[
                    {
                        "name": "spell_proficiency",
                        "path": [
                            "action",
                            "resolved",
                            "proficiency_modifier",
                        ],
                    },
                    {"name": "arcane", "path": ["stats", "arcane"]},
                    {
                        "name": "base_damage",
                        "path": [
                            "action",
                            "attributes",
                            ACTION_BASE_SPELL_DAMAGE_ATTRIBUTE_ID,
                        ],
                    },
                ],
                tags=["damage", "spell", "fire"],
            ),
        },
        {
            "id": "gate_lore_roll",
            "formula": formula(
                (
                    "Gate Lore: /r floor((1 + @lore_proficiency) "
                    "* (1d100 / 100) * @perception)"
                ),
                aliases=[
                    {
                        "name": "lore_proficiency",
                        "path": [
                            "action",
                            "resolved",
                            "proficiency_modifier",
                        ],
                    },
                    {"name": "perception", "path": ["stats", "perception"]},
                ],
                tags=["check", "knowledge", "gate"],
            ),
        },
    ]


def attribute_bridge(attribute_id: str, value_type: str, value: Any) -> dict[str, Any]:
    return {
        "relationship_id": f"fixture_attribute_{attribute_id}",
        "attribute_id": attribute_id,
        "value": {"type": value_type, "value": value},
    }


def rank_attribute(rank: str) -> dict[str, dict[str, Any]]:
    return {ACTION_RANK_ATTRIBUTE_ID: attribute_bridge(ACTION_RANK_ATTRIBUTE_ID, "enum", rank)}


def selector(
    *required_tags: str,
    excluded_tags: tuple[str, ...] = (),
    action_id: str | None = None,
    formula_id: str | None = None,
    step_id: str | None = None,
    same_source_item: bool = False,
) -> dict[str, Any]:
    return {
        "required_tags": list(required_tags),
        "excluded_tags": list(excluded_tags),
        "action_id": action_id,
        "formula_id": formula_id,
        "step_id": step_id,
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
    duration: str | None = None,
    expires_at: str | None = None,
    removal_condition: str | None = None,
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
            "duration": duration,
            "expires_at": expires_at,
            "removal_condition": removal_condition,
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
    excluded_tags: tuple[str, ...] = (),
    action_id: str | None = None,
    formula_id: str | None = None,
    step_id: str | None = None,
    same_source_item: bool = False,
) -> dict[str, Any]:
    return {
        "type": "evaluation_formula_modifier",
        "operation": operation,
        "value": formula(value, aliases=aliases),
        "selector": selector(
            *required_tags,
            excluded_tags=excluded_tags,
            action_id=action_id,
            formula_id=formula_id,
            step_id=step_id,
            same_source_item=same_source_item,
        ),
    }


def roll_mode_effect(
    *required_tags: str,
    roll_mode: str = "advantage",
    action_id: str | None = None,
) -> dict[str, Any]:
    return {
        "type": "roll_mode_modifier",
        "roll_mode": roll_mode,
        "selector": selector(*required_tags, action_id=action_id),
    }


def weapon_attributes(
    *,
    base_damage: int,
    name: str,
    weapon_type: str = "Sword",
    governing_stat: str = "strength",
    damage_types: list[str] | None = None,
    proficiency: str = "long_swords",
) -> dict[str, dict[str, Any]]:
    values = {
        WEAPON_TYPE_ATTRIBUTE_ID: ("text", weapon_type),
        WEAPON_BASE_DAMAGE_ATTRIBUTE_ID: ("number", base_damage),
        WEAPON_GOVERNING_STAT_ATTRIBUTE_ID: ("enum", governing_stat),
        WEAPON_DAMAGE_TYPES_ATTRIBUTE_ID: ("list", damage_types or ["Slashing"]),
        WEAPON_REACH_ATTRIBUTE_ID: ("number", 5),
        WEAPON_PROFICIENCY_ATTRIBUTE_ID: ("reference", proficiency),
        WEAPON_PROFICIENCY_GROWTH_RATE_ATTRIBUTE_ID: ("number", 0.01),
    }
    return {
        attribute_id: {
            **attribute_bridge(attribute_id, value_type, value),
            "relationship_id": f"fixture_{name}_{attribute_id}",
        }
        for attribute_id, (value_type, value) in values.items()
    }


def campaign_attribute_payloads() -> list[dict[str, Any]]:
    return [
        {
            "id": "campaign_role",
            "name": "Campaign Role",
            "description": "Starter campaign role such as hunter, striker, or enemy.",
            "subject_types": ["sheet"],
            "value_type": "text",
            "default_value": {"type": "text", "value": "Unassigned"},
        },
        {
            "id": "gate_affinity",
            "name": "Gate Affinity",
            "description": "Narrative gate affinity for the starter dungeon theme.",
            "subject_types": ["sheet"],
            "value_type": "enum",
            "default_value": {"type": "enum", "value": "None"},
            "validation_options": ["None", "Fire", "Shadow", "Ash"],
        },
        {
            "id": "guild_rank",
            "name": "Guild Rank",
            "description": "Local hunter-guild tier for table reference.",
            "subject_types": ["sheet"],
            "value_type": "enum",
            "default_value": {"type": "enum", "value": "Unranked"},
            "validation_options": ["Unranked", "E", "D", "C", "B", "A", "S"],
        },
    ]


def proficiency_payloads() -> list[dict[str, Any]]:
    return [
        {
            "id": "pyromancy",
            "name": "Pyromancy",
            "description": "Campaign spell proficiency for fire-attribute magic.",
            "category": "custom",
        },
        {
            "id": "shadow_steps",
            "name": "Shadow Steps",
            "description": "Campaign skill proficiency for short burst shadow movement.",
            "category": "custom",
        },
        {
            "id": "gate_lore",
            "name": "Gate Lore",
            "description": "Campaign knowledge proficiency for dungeon gates and cores.",
            "category": "custom",
        },
    ]


def action_attribute_bridge(attribute_id: str, value_type: str, value: Any) -> dict[str, Any]:
    return {
        **attribute_bridge(attribute_id, value_type, value),
        "relationship_id": f"fixture_action_attribute_{attribute_id}",
    }


def spell_action_attributes(
    *,
    rank: str,
    mana_cost: int,
    base_damage: int,
    proficiency: str,
) -> dict[str, dict[str, Any]]:
    return {
        ACTION_RANK_ATTRIBUTE_ID: action_attribute_bridge(
            ACTION_RANK_ATTRIBUTE_ID,
            "enum",
            rank,
        ),
        ACTION_MANA_COST_ATTRIBUTE_ID: action_attribute_bridge(
            ACTION_MANA_COST_ATTRIBUTE_ID,
            "number",
            mana_cost,
        ),
        ACTION_BASE_SPELL_DAMAGE_ATTRIBUTE_ID: action_attribute_bridge(
            ACTION_BASE_SPELL_DAMAGE_ATTRIBUTE_ID,
            "number",
            base_damage,
        ),
        ACTION_PROFICIENCY_ATTRIBUTE_ID: action_attribute_bridge(
            ACTION_PROFICIENCY_ATTRIBUTE_ID,
            "reference",
            proficiency,
        ),
    }


def condition_payloads() -> list[dict[str, Any]]:
    return [
        {
            "id": "shadow_bound",
            "name": "Shadow Bound",
            "description": (
                "Restrained by living shadow; manual duration until escaped or removed."
            ),
            "visibility": "public",
            "augmentation_ids": [],
            "augmentation_templates": [
                augmentation(
                    "shadow_bound_dodge_penalty",
                    "Dodge Disadvantage",
                    root="instance",
                    path=["mana"],
                    effect=roll_mode_effect(
                        "check",
                        "dodge",
                        roll_mode="disadvantage",
                    ),
                    description=(
                        "Dodge checks roll with disadvantage while restrained."
                    ),
                    duration="Until the character escapes",
                    removal_condition="Escape succeeds or the binding source ends",
                )
            ],
        },
        {
            "id": "bleeding",
            "name": "Bleeding",
            "description": (
                "Open wound; MVP handling is manual, with a visible health pressure "
                "effect while applied."
            ),
            "visibility": "public",
            "augmentation_ids": [],
            "augmentation_templates": [
                augmentation(
                    "bleeding_health_pressure",
                    "Bleeding Health Pressure",
                    root="instance",
                    path=["health"],
                    effect=direct_effect("subtract", "2"),
                    description=(
                        "Reduces current health by 2 while Bleeding is applied; "
                        "removal restores that temporary reduction."
                    ),
                    duration="Until treated",
                    removal_condition="Bleeding is treated or otherwise stopped",
                )
            ],
        },
        {
            "id": "arcane_surge",
            "name": "Arcane Surge",
            "description": (
                "A short-lived spell surge that strengthens Ember Bolt damage."
            ),
            "visibility": "public",
            "augmentation_ids": [],
            "augmentation_templates": [
                augmentation(
                    "arcane_surge_ember_bolt_damage",
                    "Empowered Ember Bolt",
                    root="instance",
                    path=["mana"],
                    effect=evaluation_effect(
                        "add",
                        "4",
                        "damage",
                        "spell",
                        excluded_tags=("healing",),
                        formula_id="ember_bolt_damage_roll",
                    ),
                    description=(
                        "Adds 4 only when the Ember Bolt damage formula is evaluated."
                    ),
                    duration="Three rounds",
                    expires_at="End of the affected character's third turn",
                    removal_condition="The surge expires or is dispelled",
                )
            ],
        },
        {
            "id": "hidden_gate_mark",
            "name": "Hidden Gate Mark",
            "description": (
                "A GM-only narrative marker with no automatic mechanical effect."
            ),
            "visibility": "gm_only",
            "augmentation_ids": [],
            "augmentation_templates": [],
        },
    ]


def item_payloads() -> list[dict[str, Any]]:
    sword_of_mana_attributes = weapon_attributes(base_damage=0, name="sword_of_mana")
    sword_of_mana_attributes.update(
        {
            ITEM_MANA_EFFICIENCY_ATTRIBUTE_ID: attribute_bridge(
                ITEM_MANA_EFFICIENCY_ATTRIBUTE_ID,
                "number",
                100,
            ),
            ITEM_FLAT_EFFECT_BONUS_ATTRIBUTE_ID: attribute_bridge(
                ITEM_FLAT_EFFECT_BONUS_ATTRIBUTE_ID,
                "number",
                50,
            ),
            ITEM_MANA_REGENERATION_MODIFIER_ATTRIBUTE_ID: attribute_bridge(
                ITEM_MANA_REGENERATION_MODIFIER_ATTRIBUTE_ID,
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
            "attributes": {},
            "attribute_profile": None,
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
            "attributes": weapon_attributes(base_damage=15, name="never_dulls"),
            "attribute_profile": "weapon",
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
            "attributes": {
                ITEM_ATTRIBUTE_ATTRIBUTE_ID: attribute_bridge(
                    ITEM_ATTRIBUTE_ATTRIBUTE_ID,
                    "text",
                    "Fire",
                )
            },
            "attribute_profile": None,
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
            "attributes": {},
            "attribute_profile": None,
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
            "attributes": {},
            "attribute_profile": None,
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
            "attributes": sword_of_mana_attributes,
            "attribute_profile": "weapon",
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
                                    "attributes",
                                    ITEM_FLAT_EFFECT_BONUS_ATTRIBUTE_ID,
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
        {
            "id": "night_fang",
            "name": "Night Fang",
            "interaction_type": "equippable",
            "category": "Dagger",
            "rank": "C",
            "description": "A short blade carried by gate scouts.",
            "price": "1,200 CP",
            "weight": "1 lb",
            "attributes": weapon_attributes(
                base_damage=9,
                name="night_fang",
                weapon_type="Dagger",
                governing_stat="dexterity",
                damage_types=["Piercing"],
                proficiency="knives",
            ),
            "attribute_profile": "weapon",
            "augmentation_templates": [],
            "action_grants": [
                {
                    "action_id": "weapon_attack",
                    "availability": "equipped",
                    "consume_quantity": 0,
                },
                {
                    "action_id": "weapon_damage",
                    "availability": "equipped",
                    "consume_quantity": 0,
                },
            ],
        },
        {
            "id": "lesser_mana_vial",
            "name": "Lesser Mana Vial",
            "interaction_type": "consumable",
            "category": "Potion",
            "rank": "D",
            "description": "Restores 25 mana when consumed.",
            "price": "250 CP",
            "weight": "0.2 lbs",
            "attributes": {},
            "attribute_profile": None,
            "augmentation_templates": [],
            "action_grants": [
                {
                    "action_id": "lesser_mana_vial_drink",
                    "availability": "carried",
                    "consume_quantity": 1,
                }
            ],
        },
        {
            "id": "emberleaf_poultice",
            "name": "Emberleaf Poultice",
            "interaction_type": "consumable",
            "category": "Medical",
            "rank": "E",
            "description": "A field dressing that restores 8 health.",
            "price": "80 CP",
            "weight": "0.5 lbs",
            "attributes": {},
            "attribute_profile": None,
            "augmentation_templates": [],
            "action_grants": [
                {
                    "action_id": "emberleaf_poultice_apply",
                    "availability": "carried",
                    "consume_quantity": 1,
                }
            ],
        },
        {
            "id": "hunter_license",
            "name": "Hunter License",
            "interaction_type": "inventory_only",
            "category": "Credential",
            "rank": "E",
            "description": "Starter guild credential for gate entry.",
            "price": "N/A",
            "weight": "0 lbs",
            "attributes": {},
            "attribute_profile": None,
            "augmentation_templates": [],
            "action_grants": [],
        },
        {
            "id": "black_gate_core",
            "name": "Black Gate Core",
            "interaction_type": "inventory_only",
            "category": "Quest Item",
            "rank": "B",
            "description": "A dormant core recovered from a sealed gate.",
            "price": "Unknown",
            "weight": "2 lbs",
            "attributes": {},
            "attribute_profile": None,
            "augmentation_templates": [],
            "action_grants": [],
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
            "id": "guarded_stance",
            "name": "Guarded Stance",
            "description": (
                "Temporarily adds 10% physical resistance while the stance is active."
            ),
            "scope": "instance",
            "target": {"root": "instance", "path": ["resistances", "physical"]},
            "effect": direct_effect("add", "0.10"),
            "active": True,
            "lifecycle": {
                "duration": "Until the stance ends",
                "expires_at": None,
                "removal_condition": "An action removes Guarded Stance",
            },
        },
        {
            "id": "parry_advantage",
            "name": "Parry Advantage",
            "description": "Always grants advantage on tagged Parry attempts.",
            "scope": "instance",
            "target": {"root": "instance", "path": ["mana"]},
            "effect": roll_mode_effect(
                "check",
                "parry",
                action_id="weapon_parry",
            ),
            "active": True,
            "lifecycle": {
                "duration": "Until removed",
                "removal_condition": "Parry training effect is dismissed",
            },
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
            "attributes": rank_attribute("C"),
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
            "attributes": rank_attribute("S"),
            "steps": [
                {
                    "step_id": "spend_mana",
                    "type": "decrement_value",
                    "target": "caster",
                    "path": ["mana"],
                    "amount": formula_reference("flames_of_life_mana_cost"),
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
                    "amount": formula_reference("flames_of_life_healing"),
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
            "attributes": rank_attribute("A"),
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
            "attributes": {},
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
            "attributes": {},
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
        {
            "id": "ember_bolt_to_hit",
            "name": "Ember Bolt To-Hit",
            "roll_mode_kind": "check",
            "notes": "Starter fire spell attack roll.",
            "attributes": spell_action_attributes(
                rank="D",
                mana_cost=12,
                base_damage=18,
                proficiency="pyromancy",
            ),
            "steps": [
                {
                    "step_id": "roll_spell_attack",
                    "type": "send_message",
                    "message": formula_reference("ember_bolt_attack_roll"),
                }
            ],
        },
        {
            "id": "ember_bolt_damage",
            "name": "Ember Bolt Damage",
            "roll_mode_kind": "damage",
            "notes": "Starter fire spell damage with a mana cost.",
            "attributes": spell_action_attributes(
                rank="D",
                mana_cost=12,
                base_damage=18,
                proficiency="pyromancy",
            ),
            "steps": [
                {
                    "step_id": "spend_mana",
                    "type": "decrement_value",
                    "target": "caster",
                    "path": ["mana"],
                    "amount": formula(
                        "@mana_cost",
                        aliases=[
                            {
                                "name": "mana_cost",
                                "path": [
                                    "action",
                                    "attributes",
                                    ACTION_MANA_COST_ATTRIBUTE_ID,
                                ],
                            }
                        ],
                    ),
                    "min_value": formula("0"),
                    "max_value": None,
                    "on_min_violation": "reject",
                    "on_max_violation": "clamp",
                },
                {
                    "step_id": "roll_spell_damage",
                    "type": "send_message",
                    "message": formula_reference("ember_bolt_damage_roll"),
                },
            ],
        },
        {
            "id": "shadow_step",
            "name": "Shadow Step",
            "roll_mode_kind": "check",
            "notes": "Short evasive movement check for shadow-affinity hunters.",
            "attributes": {
                **rank_attribute("C"),
                ACTION_PROFICIENCY_ATTRIBUTE_ID: action_attribute_bridge(
                    ACTION_PROFICIENCY_ATTRIBUTE_ID,
                    "reference",
                    "shadow_steps",
                ),
            },
            "steps": [
                {
                    "step_id": "roll_shadow_step",
                    "type": "send_message",
                    "message": formula(
                        (
                            "Shadow Step: /r floor((1 + @step_proficiency) "
                            "* (1d100 / 100) * @dexterity)"
                        ),
                        aliases=[
                            {
                                "name": "step_proficiency",
                                "path": [
                                    "action",
                                    "resolved",
                                    "proficiency_modifier",
                                ],
                            },
                            {"name": "dexterity", "path": ["stats", "dexterity"]},
                        ],
                        tags=["check", "movement", "shadow"],
                    ),
                }
            ],
        },
        {
            "id": "lesser_mana_vial_drink",
            "name": "Drink Lesser Mana Vial",
            "roll_mode_kind": "none",
            "notes": "Consumable action: restore 25 mana, then consume one vial.",
            "attributes": {},
            "steps": [
                {
                    "step_id": "restore_mana",
                    "type": "increment_value",
                    "target": "caster",
                    "path": ["mana"],
                    "amount": formula("25"),
                    "min_value": formula("0"),
                    "max_value": formula(
                        "@max_mana",
                        aliases=[{"name": "max_mana", "path": ["stats", "mana"]}],
                    ),
                    "on_min_violation": "clamp",
                    "on_max_violation": "clamp",
                }
            ],
        },
        {
            "id": "emberleaf_poultice_apply",
            "name": "Apply Emberleaf Poultice",
            "roll_mode_kind": "none",
            "notes": "Consumable action: restore 8 health, then consume one poultice.",
            "attributes": {},
            "steps": [
                {
                    "step_id": "restore_health",
                    "type": "increment_value",
                    "target": "caster",
                    "path": ["health"],
                    "amount": formula("8"),
                    "min_value": formula("0"),
                    "max_value": formula(
                        "@max_health",
                        aliases=[
                            {"name": "max_health", "path": ["stats", "health"]}
                        ],
                    ),
                    "on_min_violation": "clamp",
                    "on_max_violation": "clamp",
                }
            ],
        },
        {
            "id": "apply_shadow_bound",
            "name": "Apply Shadow Bound",
            "roll_mode_kind": "none",
            "notes": "Applies the Shadow Bound condition to the acting instance.",
            "attributes": rank_attribute("C"),
            "steps": [
                {
                    "step_id": "apply_shadow_bound",
                    "type": "apply_condition_preset",
                    "target": "caster",
                    "condition_id": "shadow_bound",
                    "operation": "apply",
                }
            ],
        },
        {
            "id": "remove_shadow_bound",
            "name": "Remove Shadow Bound",
            "roll_mode_kind": "none",
            "notes": "Removes the Shadow Bound condition from the acting instance.",
            "attributes": rank_attribute("C"),
            "steps": [
                {
                    "step_id": "remove_shadow_bound",
                    "type": "apply_condition_preset",
                    "target": "caster",
                    "condition_id": "shadow_bound",
                    "operation": "remove",
                }
            ],
        },
        {
            "id": "apply_bleeding",
            "name": "Apply Bleeding",
            "roll_mode_kind": "none",
            "notes": "Applies the Bleeding condition to the acting instance.",
            "attributes": rank_attribute("E"),
            "steps": [
                {
                    "step_id": "apply_bleeding",
                    "type": "apply_condition_preset",
                    "target": "caster",
                    "condition_id": "bleeding",
                    "operation": "apply",
                }
            ],
        },
        {
            "id": "gate_lore_check",
            "name": "Gate Lore Check",
            "roll_mode_kind": "check",
            "notes": "Campaign knowledge check for gate behavior and dungeon cores.",
            "attributes": {
                **rank_attribute("D"),
                ACTION_PROFICIENCY_ATTRIBUTE_ID: action_attribute_bridge(
                    ACTION_PROFICIENCY_ATTRIBUTE_ID,
                    "reference",
                    "gate_lore",
                ),
            },
            "steps": [
                {
                    "step_id": "roll_gate_lore",
                    "type": "send_message",
                    "message": formula_reference("gate_lore_roll"),
                }
            ],
        },
        {
            "id": "train_shadow_steps",
            "name": "Train Shadow Steps",
            "roll_mode_kind": "none",
            "notes": "Starter proficiency-gain action for table testing.",
            "attributes": rank_attribute("C"),
            "steps": [
                {
                    "step_id": "gain_shadow_step_use",
                    "type": "gain_proficiency_use",
                    "target": "caster",
                    "proficiency_id": "shadow_steps",
                    "amount": formula("1"),
                }
            ],
        },
        {
            "id": "red_gate_claw",
            "name": "Red Gate Claw",
            "roll_mode_kind": "damage",
            "notes": "Enemy claw damage roll.",
            "attributes": rank_attribute("E"),
            "steps": [
                {
                    "step_id": "roll_claw_damage",
                    "type": "send_message",
                    "message": formula(
                        "Red Gate Claw: /r floor(1d6 + @strength)",
                        aliases=[
                            {"name": "strength", "path": ["stats", "strength"]}
                        ],
                        tags=["damage", "weapon", "slashing"],
                    ),
                }
            ],
        },
        {
            "id": "ash_wraith_spark",
            "name": "Ash Wraith Spark",
            "roll_mode_kind": "damage",
            "notes": "Enemy fire/ash damage roll.",
            "attributes": rank_attribute("D"),
            "steps": [
                {
                    "step_id": "roll_spark_damage",
                    "type": "send_message",
                    "message": formula(
                        "Ash Wraith Spark: /r floor(1d8 + @arcane)",
                        aliases=[{"name": "arcane", "path": ["stats", "arcane"]}],
                        tags=["damage", "spell", "fire"],
                    ),
                }
            ],
        },
    ]


def sheet_attributes(
    *,
    campaign_role: str,
    gate_affinity: str,
    guild_rank: str,
) -> dict[str, dict[str, Any]]:
    return {
        "campaign_role": attribute_bridge("campaign_role", "text", campaign_role),
        "gate_affinity": attribute_bridge("gate_affinity", "enum", gate_affinity),
        "guild_rank": attribute_bridge("guild_rank", "enum", guild_rank),
    }


def stats_payload(
    *,
    strength: int,
    dexterity: int,
    constitution: int,
    perception: int,
    arcane: int,
    will: int,
    health: int,
    mana: int,
) -> dict[str, Any]:
    formula_stats = {
        name: asdict(value) for name, value in default_sheet_formula_stats().items()
    }
    formula_stats["health"] = formula(str(health))
    formula_stats["mana"] = formula(str(mana))
    return {
        "strength": strength,
        "dexterity": dexterity,
        "constitution": constitution,
        "perception": perception,
        "arcane": arcane,
        "will": will,
        **formula_stats,
    }


def proficiency_bridge(
    proficiency_id: str,
    *,
    use_count: int,
    growth_rate: float = 0.01,
) -> dict[str, Any]:
    return {
        "relationship_id": f"fixture_{proficiency_id}",
        "prof_id": proficiency_id,
        "use_count": use_count,
        "growth_rate": growth_rate,
    }


def item_bridge(
    item_id: str,
    *,
    count: int = 1,
    equipped: bool = False,
) -> dict[str, Any]:
    return {
        "relationship_id": f"inventory_{item_id}",
        "count": count,
        "equipped": equipped,
        "item_id": item_id,
    }


def action_bridge(action_id: str) -> dict[str, str]:
    return {
        "relationship_id": f"assigned_{action_id}",
        "entry_id": action_id,
    }


def sheet_payload() -> dict[str, Any]:
    items = {
        f"inventory_{item_id}": item_bridge(item_id, equipped=True)
        for item_id in ITEM_IDS
    }
    items.update(
        {
            "inventory_lesser_mana_vial": item_bridge(
                "lesser_mana_vial",
                count=2,
            ),
            "inventory_emberleaf_poultice": item_bridge(
                "emberleaf_poultice",
                count=1,
            ),
            "inventory_hunter_license": item_bridge("hunter_license"),
        }
    )
    actions = {
        f"assigned_{action_id}": action_bridge(action_id)
        for action_id in (
            *ACTION_IDS,
            "fixture_fire_damage",
            "fixture_mana_overload",
            "ember_bolt_to_hit",
            "ember_bolt_damage",
            "gate_lore_check",
            "train_shadow_steps",
        )
    }
    return {
        "id": SHEET_ID,
        "name": "Example Player 1",
        "notes": (
            "DM reference template: fire-affinity striker/healer with formulas, "
            "actions, equipment, consumables, proficiencies, and XP progress."
        ),
        "dm_only": False,
        "xp_given_when_slayed": 0,
        "xp_cap": 100,
        "proficiencies": {
            "fixture_long_swords": proficiency_bridge("long_swords", use_count=0),
            "fixture_pyromancy": proficiency_bridge("pyromancy", use_count=30),
            "fixture_gate_lore": proficiency_bridge("gate_lore", use_count=12),
        },
        "items": items,
        "stats": stats_payload(
            strength=10,
            dexterity=10,
            constitution=10,
            perception=10,
            arcane=10,
            will=10,
            health=100,
            mana=200,
        ),
        "resistances": {},
        "slayed_record": {},
        "actions": actions,
        "attributes": sheet_attributes(
            campaign_role="Player striker/healer",
            gate_affinity="Fire",
            guild_rank="C",
        ),
    }


def shadowblade_sheet_payload() -> dict[str, Any]:
    return {
        "id": SHADOWBLADE_SHEET_ID,
        "name": "Example Player 2",
        "notes": (
            "DM reference template: quick melee scout with item-granted actions, "
            "conditions, proficiency growth, and a completed XP threshold."
        ),
        "dm_only": False,
        "xp_given_when_slayed": 0,
        "xp_cap": 60,
        "proficiencies": {
            "fixture_knives": proficiency_bridge("knives", use_count=42),
            "fixture_shadow_steps": proficiency_bridge(
                "shadow_steps",
                use_count=18,
                growth_rate=0.02,
            ),
            "fixture_gate_lore": proficiency_bridge("gate_lore", use_count=8),
        },
        "items": {
            "inventory_night_fang": item_bridge("night_fang", equipped=True),
            "inventory_lesser_mana_vial": item_bridge(
                "lesser_mana_vial",
                count=2,
            ),
            "inventory_hunter_license": item_bridge("hunter_license"),
            "inventory_black_gate_core": item_bridge("black_gate_core"),
        },
        "stats": stats_payload(
            strength=8,
            dexterity=14,
            constitution=9,
            perception=12,
            arcane=11,
            will=10,
            health=90,
            mana=130,
        ),
        "resistances": {},
        "slayed_record": {},
        "actions": {
            "assigned_shadow_step": action_bridge("shadow_step"),
            "assigned_gate_lore_check": action_bridge("gate_lore_check"),
            "assigned_train_shadow_steps": action_bridge("train_shadow_steps"),
            "assigned_apply_shadow_bound": action_bridge("apply_shadow_bound"),
            "assigned_remove_shadow_bound": action_bridge("remove_shadow_bound"),
        },
        "attributes": sheet_attributes(
            campaign_role="Player scout",
            gate_affinity="Shadow",
            guild_rank="D",
        ),
    }


def goblin_sheet_payload() -> dict[str, Any]:
    return {
        "id": GOBLIN_SHEET_ID,
        "name": "Red Gate Goblin",
        "notes": "Starter enemy template: fast minion from an unstable red gate.",
        "dm_only": True,
        "xp_given_when_slayed": 15,
        "xp_cap": 0,
        "proficiencies": {},
        "items": {},
        "stats": stats_payload(
            strength=7,
            dexterity=12,
            constitution=7,
            perception=9,
            arcane=2,
            will=5,
            health=32,
            mana=10,
        ),
        "resistances": {"fire": 0.05},
        "slayed_record": {},
        "actions": {
            "assigned_red_gate_claw": action_bridge("red_gate_claw"),
            "assigned_apply_bleeding": action_bridge("apply_bleeding"),
        },
        "attributes": sheet_attributes(
            campaign_role="Enemy skirmisher",
            gate_affinity="None",
            guild_rank="Unranked",
        ),
    }


def wraith_sheet_payload() -> dict[str, Any]:
    return {
        "id": WRAITH_SHEET_ID,
        "name": "Ash Wraith",
        "notes": "Starter enemy template: elite ash caster guarding a gate core.",
        "dm_only": True,
        "xp_given_when_slayed": 45,
        "xp_cap": 0,
        "proficiencies": {
            "fixture_pyromancy": proficiency_bridge("pyromancy", use_count=20),
        },
        "items": {},
        "stats": stats_payload(
            strength=6,
            dexterity=11,
            constitution=8,
            perception=11,
            arcane=14,
            will=12,
            health=70,
            mana=120,
        ),
        "resistances": {"fire": 0.30, "dark": 0.10},
        "slayed_record": {},
        "actions": {
            "assigned_ash_wraith_spark": action_bridge("ash_wraith_spark"),
            "assigned_apply_shadow_bound": action_bridge("apply_shadow_bound"),
        },
        "attributes": sheet_attributes(
            campaign_role="Enemy caster",
            gate_affinity="Ash",
            guild_rank="Unranked",
        ),
    }


def sheet_payloads() -> list[dict[str, Any]]:
    return [
        sheet_payload(),
        shadowblade_sheet_payload(),
        goblin_sheet_payload(),
        wraith_sheet_payload(),
    ]


def encounter_payloads() -> list[dict[str, Any]]:
    return [
        {
            "id": "red_gate_scouts",
            "name": "Red Gate Scouts",
            "updated_at": "2026-07-03T00:00:00+00:00",
            "entries": [
                {"template_id": GOBLIN_SHEET_ID, "count": 3},
            ],
        },
        {
            "id": "ash_wraith_threshold",
            "name": "Ash Wraith Threshold",
            "updated_at": "2026-07-03T00:00:00+00:00",
            "entries": [
                {"template_id": WRAITH_SHEET_ID, "count": 1},
                {"template_id": GOBLIN_SHEET_ID, "count": 2},
            ],
        },
    ]


def authoring_requests(
    *,
    mana_manipulation_effect_bonus: int,
) -> list[dict[str, Any]]:
    requests: list[dict[str, Any]] = []
    requests.extend(
        {"type": "create_attribute", "attribute": attribute}
        for attribute in campaign_attribute_payloads()
    )
    requests.extend(
        {"type": "create_proficiency", "proficiency": proficiency}
        for proficiency in proficiency_payloads()
    )
    requests.extend(
        {"type": "create_standalone_effect", "effect": effect}
        for effect in standalone_effect_payloads(
            mana_manipulation_effect_bonus=mana_manipulation_effect_bonus,
        )
    )
    requests.extend(
        {"type": "create_condition_preset", "condition": condition}
        for condition in condition_payloads()
    )
    requests.extend(
        {"type": "create_formula", "formula": formula_definition}
        for formula_definition in formula_payloads()
    )
    requests.extend(
        {"type": "create_action", "action": action}
        for action in action_payloads()
    )
    requests.extend(
        {"type": "create_item", "item": item}
        for item in item_payloads()
    )
    requests.extend(
        {"type": "create_sheet", "sheet": sheet}
        for sheet in sheet_payloads()
    )
    requests.extend(
        {"type": "save_encounter_preset", "encounter": encounter}
        for encounter in encounter_payloads()
    )
    requests.append(
        {
            "type": "create_instanced_sheet",
            "instance_id": INSTANCE_ID,
            "parent_sheet_id": SHEET_ID,
            "notes": "Example Player 1 runtime instance for DM reference.",
            "health": 50,
            "mana": 200,
            "resistances": {},
            "generate_access_code": False,
        }
    )
    requests.append(
        {
            "type": "create_instanced_sheet",
            "instance_id": SHADOWBLADE_INSTANCE_ID,
            "parent_sheet_id": SHADOWBLADE_SHEET_ID,
            "notes": "Example Player 2 runtime instance for DM reference.",
            "health": 62,
            "mana": 80,
            "resistances": {},
            "generate_access_code": False,
        }
    )
    requests.extend(
        [
            {
                "type": "record_kill",
                "kill_id": "seed_example_1_goblin_1",
                "credited_instance_id": INSTANCE_ID,
                "monster_sheet_id": GOBLIN_SHEET_ID,
                "occurred_at": "2026-07-01T19:00:00+00:00",
            },
            {
                "type": "record_kill",
                "kill_id": "seed_example_1_goblin_2",
                "credited_instance_id": INSTANCE_ID,
                "monster_sheet_id": GOBLIN_SHEET_ID,
                "occurred_at": "2026-07-01T19:05:00+00:00",
            },
            {
                "type": "record_kill",
                "kill_id": "seed_example_1_wraith",
                "credited_instance_id": INSTANCE_ID,
                "monster_sheet_id": WRAITH_SHEET_ID,
                "occurred_at": "2026-07-01T19:10:00+00:00",
            },
            {
                "type": "record_kill",
                "kill_id": "seed_example_2_goblin",
                "credited_instance_id": SHADOWBLADE_INSTANCE_ID,
                "monster_sheet_id": GOBLIN_SHEET_ID,
                "occurred_at": "2026-07-01T19:15:00+00:00",
            },
            {
                "type": "record_kill",
                "kill_id": "seed_example_2_wraith",
                "credited_instance_id": SHADOWBLADE_INSTANCE_ID,
                "monster_sheet_id": WRAITH_SHEET_ID,
                "occurred_at": "2026-07-01T19:20:00+00:00",
            },
        ]
    )
    return requests
