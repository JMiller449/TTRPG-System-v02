from __future__ import annotations

from collections.abc import Callable
from copy import deepcopy
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from math import isfinite
import re
from typing import Any

from backend.state.default_actions import (
    BASELINE_SHEET_CHECKS,
    CANONICAL_ACTION_PRESETS,
    WEAPON_ACTION_IDS,
    normalize_weapon_action_grant_payloads,
    seeded_global_action_payloads,
)

CURRENT_STATE_SCHEMA_VERSION = 30

_LEGACY_ITEM_REVIEW_NOTE = (
    "Migration note: legacy item effect text remains in the public description. "
    "Review the interaction type and convert any mechanics to actions or augmentations."
)


class PersistedStateError(RuntimeError):
    """Raised when persisted state cannot be safely loaded or migrated."""


@dataclass(frozen=True)
class StateMigrationResult:
    state: dict[str, Any]
    source_version: int
    migrated: bool


PersistedEnvelope = dict[str, Any]
Migration = Callable[[PersistedEnvelope], PersistedEnvelope]


def _migrate_v0_to_v1(envelope: PersistedEnvelope) -> PersistedEnvelope:
    return {
        "schema_version": 1,
        "state": envelope["state"],
    }


def _legacy_description_value(description: str, label: str) -> str:
    prefix = f"{label}:"
    for line in description.splitlines():
        stripped = line.strip()
        if stripped.startswith(prefix):
            return stripped[len(prefix) :].strip()
    return ""


def _migrate_legacy_item_description(
    description: str,
) -> tuple[str, str, str, bool]:
    category = _legacy_description_value(description, "Type")
    rank = _legacy_description_value(description, "Rank")
    immediate = _legacy_description_value(description, "Immediate Effects")
    non_immediate = _legacy_description_value(description, "Non-Immediate Effects")
    labels = ("Type:", "Rank:", "Immediate Effects:", "Non-Immediate Effects:")
    retained_lines = [
        line.strip()
        for line in description.splitlines()
        if line.strip() and not line.strip().startswith(labels)
    ]
    reference_lines = [
        *retained_lines,
        *(
            [f"Immediate effect (legacy reference): {immediate}"]
            if immediate
            else []
        ),
        *(
            [f"Non-immediate effect (legacy reference): {non_immediate}"]
            if non_immediate
            else []
        ),
    ]
    return "\n".join(reference_lines), category, rank, bool(immediate or non_immediate)


def _migrate_v1_to_v2(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    sheets = state.get("sheets", {})
    equipped_item_ids: set[str] = set()

    if isinstance(sheets, dict):
        for sheet in sheets.values():
            if not isinstance(sheet, dict):
                continue
            bridges = sheet.get("items", {})
            if not isinstance(bridges, dict):
                continue
            for bridge in bridges.values():
                if not isinstance(bridge, dict):
                    continue
                equipped = bool(bridge.get("equipped", bridge.get("active", False)))
                bridge["equipped"] = equipped
                bridge.pop("active", None)
                if equipped and isinstance(bridge.get("item_id"), str):
                    equipped_item_ids.add(bridge["item_id"])

    items = state.get("items", {})
    if isinstance(items, dict):
        for item_id, item in items.items():
            if not isinstance(item, dict):
                continue

            description = item.get("description", "")
            if not isinstance(description, str):
                description = str(description)
            (
                migrated_description,
                category,
                rank,
                effect_text_present,
            ) = _migrate_legacy_item_description(
                description
            )
            item["description"] = migrated_description
            item["category"] = item.get("category") or category
            item["rank"] = item.get("rank") or rank

            augmentations = item.get("augmentation_templates", [])
            grants = item.get("action_grants", [])
            valid_grants = (
                [grant for grant in grants if isinstance(grant, dict)]
                if isinstance(grants, list)
                else []
            )
            has_equippable_signal = (
                item_id in equipped_item_ids
                or bool(augmentations)
                or any(grant.get("availability") == "equipped" for grant in valid_grants)
            )
            has_consumable_signal = any(
                grant.get("availability") == "carried"
                and isinstance(grant.get("consume_quantity", 0), int)
                and not isinstance(grant.get("consume_quantity", 0), bool)
                and grant.get("consume_quantity", 0) > 0
                for grant in valid_grants
            )

            if has_equippable_signal or (valid_grants and not has_consumable_signal):
                item["interaction_type"] = "equippable"
            elif has_consumable_signal:
                item["interaction_type"] = "consumable"
            else:
                item["interaction_type"] = "inventory_only"

            inferred_inventory_needs_review = (
                item["interaction_type"] == "inventory_only" and bool(category or rank)
            )
            if (
                effect_text_present
                or (has_equippable_signal and has_consumable_signal)
                or inferred_inventory_needs_review
            ):
                gm_notes = item.get("gm_notes", "")
                if not isinstance(gm_notes, str):
                    gm_notes = str(gm_notes)
                if _LEGACY_ITEM_REVIEW_NOTE not in gm_notes:
                    item["gm_notes"] = "\n".join(
                        part for part in (gm_notes.strip(), _LEGACY_ITEM_REVIEW_NOTE) if part
                    )

    return {
        "schema_version": 2,
        "state": state,
    }


def _migrate_v2_to_v3(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    state.setdefault("equipment_effect_projections", {})
    for augmentation in state.get("augmentations", {}).values():
        if not isinstance(augmentation, dict):
            continue
        augmentation.setdefault("lifecycle_owner", "manual")
        source = augmentation.get("source")
        if isinstance(source, dict):
            source.setdefault("relationship_id", None)
            source.setdefault("application_id", None)
    return {
        "schema_version": 3,
        "state": state,
    }


def _migrate_v3_to_v4(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    items = state.get("items", {})
    if isinstance(items, dict):
        for item_id, item in items.items():
            if not isinstance(item, dict):
                continue

            description = item.get("description", "")
            if not isinstance(description, str):
                description = str(description)
            migrated_description, category, rank, _ = _migrate_legacy_item_description(
                description
            )
            item["description"] = migrated_description
            item["category"] = item.get("category") or category
            item["rank"] = item.get("rank") or rank

            templates = item.get("augmentation_templates", [])
            if not isinstance(templates, list):
                continue
            for template in templates:
                if not isinstance(template, dict):
                    continue
                source = template.get("source")
                if not isinstance(source, dict):
                    source = {}
                    template["source"] = source
                source.update(
                    {
                        "type": "item",
                        "id": item_id,
                        "label": item.get("name", ""),
                        "relationship_id": None,
                        "application_id": None,
                    }
                )
                template["lifecycle_owner"] = "equipment"
                template["applied"] = False
                template["applied_target_id"] = None

    return {
        "schema_version": 4,
        "state": state,
    }


def _migrate_v4_to_v5(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    active_conditions = state.setdefault("active_conditions", {})
    if not isinstance(active_conditions, dict):
        active_conditions = {}
        state["active_conditions"] = active_conditions

    presets = state.get("condition_presets", {})
    augmentations = state.get("augmentations", {})
    if isinstance(augmentations, dict):
        grouped: dict[str, list[tuple[str, dict]]] = {}
        for augmentation_id, augmentation in augmentations.items():
            if not isinstance(augmentation, dict) or not augmentation.get("applied"):
                continue
            source = augmentation.get("source")
            if not isinstance(source, dict) or source.get("type") != "condition":
                continue
            condition_id = source.get("id")
            instance_id = augmentation.get("applied_target_id")
            if not isinstance(condition_id, str) or not isinstance(instance_id, str):
                continue
            application_id = source.get("application_id")
            if not isinstance(application_id, str) or not application_id:
                application_id = f"condition:{condition_id}:{instance_id}"
                source["application_id"] = application_id
            grouped.setdefault(application_id, []).append(
                (augmentation_id, augmentation)
            )

        for application_id, entries in grouped.items():
            if application_id in active_conditions:
                continue
            _, first = entries[0]
            source = first["source"]
            condition_id = source["id"]
            instance_id = first["applied_target_id"]
            preset = presets.get(condition_id, {}) if isinstance(presets, dict) else {}
            if not isinstance(preset, dict):
                preset = {}
            active_conditions[application_id] = {
                "application_id": application_id,
                "condition_id": condition_id,
                "condition_name": preset.get("name") or source.get("label") or condition_id,
                "description": preset.get("description", ""),
                "visibility": preset.get("visibility", "public"),
                "instance_id": instance_id,
                "augmentation_ids": sorted(augmentation_id for augmentation_id, _ in entries),
            }

    return {
        "schema_version": 5,
        "state": state,
    }


def _migrate_v5_to_v6(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    for collection_name in (
        "standalone_effects",
        "standalone_effect_applications",
    ):
        if not isinstance(state.get(collection_name), dict):
            state[collection_name] = {}

    return {"schema_version": 6, "state": state}


def _amount_of_reactions_formula_payload() -> dict[str, Any]:
    return {
        "type": "formula",
        "value": None,
        "formula": {
            "text": "@registration + @reaction_time",
            "aliases": [
                {"name": "registration", "path": ["stats", "registration"]},
                {"name": "reaction_time", "path": ["stats", "reaction_time"]},
            ],
            "tags": [],
        },
    }


def _migrate_v6_to_v7(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    attributes = state.setdefault("attributes", {})
    if not isinstance(attributes, dict):
        attributes = {}
        state["attributes"] = attributes
    attributes["amount_of_reactions"] = {
        "id": "amount_of_reactions",
        "name": "Amount of Reactions",
        "description": (
            "Informational derived reaction amount. Combat spending and turn "
            "enforcement remain manual."
        ),
        "subject_types": ["sheet"],
        "value_type": "number",
        "default_value": _amount_of_reactions_formula_payload(),
        "unit": "reactions",
        "visibility": "public",
        "validation_options": [],
        "reference_kind": None,
        "required": True,
    }

    sheets = state.get("sheets", {})
    if isinstance(sheets, dict):
        for sheet in sheets.values():
            if not isinstance(sheet, dict):
                continue
            sheet_attributes = sheet.setdefault("attributes", {})
            if not isinstance(sheet_attributes, dict):
                sheet_attributes = {}
                sheet["attributes"] = sheet_attributes
            sheet_attributes.setdefault(
                "amount_of_reactions",
                {
                    "relationship_id": "required_attribute_amount_of_reactions",
                    "attribute_id": "amount_of_reactions",
                    "value": _amount_of_reactions_formula_payload(),
                    "evaluated_value": None,
                    "evaluation_error": None,
                },
            )

    return {"schema_version": 7, "state": state}


def _literal_attribute_value(value_type: str, value: Any) -> dict[str, Any]:
    return {"type": value_type, "value": value, "formula": None}


def _weapon_attribute_definition(
    attribute_id: str,
    name: str,
    value_type: str,
    default_value: Any,
    *,
    description: str,
    unit: str = "",
    validation_options: list[str] | None = None,
    reference_kind: str | None = None,
) -> dict[str, Any]:
    return {
        "id": attribute_id,
        "name": name,
        "description": description,
        "subject_types": ["item"],
        "value_type": value_type,
        "default_value": _literal_attribute_value(value_type, default_value),
        "unit": unit,
        "visibility": "public",
        "validation_options": validation_options or [],
        "reference_kind": reference_kind,
        "required": True,
        "required_profile": "weapon",
    }


def _migrate_v7_to_v8(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    attributes = state.setdefault("attributes", {})
    if not isinstance(attributes, dict):
        attributes = {}
        state["attributes"] = attributes
    for definition in attributes.values():
        if isinstance(definition, dict):
            definition.setdefault("required_profile", None)

    weapon_definitions = (
        _weapon_attribute_definition(
            "weapon_type",
            "Weapon Type",
            "text",
            "",
            description="Authored weapon family or form, such as Sword or Bow.",
        ),
        _weapon_attribute_definition(
            "weapon_base_damage",
            "Base Damage",
            "number",
            0,
            description="Flat weapon damage used by eligible weapon actions.",
            unit="damage",
        ),
        _weapon_attribute_definition(
            "weapon_governing_stat",
            "Governing Stat",
            "enum",
            "strength",
            description="Core sheet stat used by eligible weapon actions.",
            validation_options=[
                "strength",
                "dexterity",
                "constitution",
                "perception",
                "arcane",
                "will",
            ],
        ),
        _weapon_attribute_definition(
            "weapon_damage_types",
            "Physical Damage Types",
            "list",
            [],
            description="Physical damage types this weapon can deal.",
            validation_options=["Slashing", "Bludgeoning", "Piercing"],
        ),
        _weapon_attribute_definition(
            "weapon_reach",
            "Reach",
            "number",
            0,
            description="Authored reach for display and future eligible actions.",
        ),
        _weapon_attribute_definition(
            "weapon_proficiency",
            "Proficiency",
            "reference",
            "",
            description="Proficiency definition used by eligible weapon actions.",
            reference_kind="proficiency",
        ),
        _weapon_attribute_definition(
            "weapon_proficiency_growth_rate",
            "Proficiency Growth Rate",
            "number",
            0,
            description="Growth rate supplied when this weapon grants proficiency use.",
        ),
    )
    for definition in weapon_definitions:
        attributes[definition["id"]] = definition

    items = state.get("items", {})
    if isinstance(items, dict):
        for item in items.values():
            if isinstance(item, dict):
                item.setdefault("attribute_profile", None)
                item.setdefault("attributes", {})

    return {"schema_version": 8, "state": state}


def _action_attribute_definition(
    attribute_id: str,
    name: str,
    value_type: str,
    default_value: Any,
    *,
    description: str,
    unit: str = "",
    validation_options: list[str] | None = None,
    reference_kind: str | None = None,
) -> dict[str, Any]:
    return {
        "id": attribute_id,
        "name": name,
        "description": description,
        "subject_types": ["action"],
        "value_type": value_type,
        "default_value": _literal_attribute_value(value_type, default_value),
        "unit": unit,
        "visibility": "public",
        "validation_options": validation_options or [],
        "reference_kind": reference_kind,
        "required": False,
        "required_profile": None,
        "backend_owned": True,
    }


def _migrate_v8_to_v9(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    attributes = state.setdefault("attributes", {})
    if not isinstance(attributes, dict):
        attributes = {}
        state["attributes"] = attributes
    for definition in attributes.values():
        if isinstance(definition, dict):
            definition.setdefault("backend_owned", False)
    for attribute_id in (
        "amount_of_reactions",
        "weapon_type",
        "weapon_base_damage",
        "weapon_governing_stat",
        "weapon_damage_types",
        "weapon_reach",
        "weapon_proficiency",
        "weapon_proficiency_growth_rate",
    ):
        definition = attributes.get(attribute_id)
        if isinstance(definition, dict):
            definition["backend_owned"] = True

    rank_options = [
        "F",
        "F+",
        "E",
        "E+",
        "D",
        "D+",
        "C",
        "C+",
        "B",
        "B+",
        "A",
        "A+",
        "S",
        "S+",
        "SS",
        "SS+",
    ]
    action_definitions = (
        _action_attribute_definition(
            "action_rank",
            "Rank",
            "enum",
            "F",
            description="Authored action or skill rank.",
            validation_options=rank_options,
        ),
        _action_attribute_definition(
            "action_range",
            "Range",
            "number",
            0,
            description=(
                "Informational action range unless a step explicitly consumes it."
            ),
        ),
        _action_attribute_definition(
            "action_target_count",
            "Target Count",
            "number",
            1,
            description="Informational target count; it does not enforce targeting.",
            unit="targets",
        ),
        _action_attribute_definition(
            "action_area",
            "Area",
            "text",
            "",
            description="Informational area or shape description.",
        ),
        _action_attribute_definition(
            "action_mana_cost",
            "Mana Cost",
            "number",
            0,
            description=(
                "Authored mana cost; no resource change occurs unless a step uses it."
            ),
            unit="mana",
        ),
        _action_attribute_definition(
            "action_base_spell_damage",
            "Base Spell Damage",
            "number",
            0,
            description="Flat spell damage available to eligible spell formulas.",
            unit="damage",
        ),
        _action_attribute_definition(
            "action_proficiency",
            "Proficiency",
            "reference",
            "",
            description="Proficiency definition used by eligible action formulas.",
            reference_kind="proficiency",
        ),
    )
    for definition in action_definitions:
        attributes[definition["id"]] = definition

    for action in state.get("actions", {}).values():
        if isinstance(action, dict):
            action.setdefault("attributes", {})

    return {"schema_version": 9, "state": state}


def _is_old_generic_action(action: Any, action_id: str) -> bool:
    if not isinstance(action, dict):
        return False
    expected_stat = {
        "attack": "strength",
        "dodge": "dexterity",
        "parry": "dexterity",
        "block": "constitution",
    }.get(action_id)
    if expected_stat is None:
        return False
    if action.get("name") != action_id.title():
        return False
    if not str(action.get("notes", "")).startswith("Default editable action preset"):
        return False
    steps = action.get("steps")
    if not isinstance(steps, list) or len(steps) != 1:
        return False
    message = steps[0].get("message") if isinstance(steps[0], dict) else None
    if not isinstance(message, dict):
        return False
    return message.get("text") == (
        f"{action_id.title()}: /r (1d100 / 100) * @{expected_stat}"
    )


def _migrate_v9_to_v10(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    actions = state.setdefault("actions", {})
    if not isinstance(actions, dict):
        actions = {}
        state["actions"] = actions

    canonical_actions = seeded_global_action_payloads()
    for obsolete_id in ("attack", "parry"):
        if _is_old_generic_action(actions.get(obsolete_id), obsolete_id):
            actions.pop(obsolete_id, None)
    for action_id, payload in canonical_actions.items():
        if action_id in {"dodge", "block"} and _is_old_generic_action(
            actions.get(action_id), action_id
        ):
            actions[action_id] = payload
            continue
        actions.setdefault(action_id, payload)

    sheets = state.get("sheets", {})
    if isinstance(sheets, dict):
        for sheet in sheets.values():
            if not isinstance(sheet, dict):
                continue
            bridges = sheet.get("actions", {})
            if not isinstance(bridges, dict):
                continue
            for relationship_id, action_id in (
                ("default_attack", "attack"),
                ("default_parry", "parry"),
            ):
                bridge = bridges.get(relationship_id)
                if isinstance(bridge, dict) and bridge.get("entry_id") == action_id:
                    bridges.pop(relationship_id, None)

    return {"schema_version": 10, "state": state}


def _sheet_attribute_definition(
    attribute_id: str,
    name: str,
    default_value: int,
    *,
    description: str,
    unit: str = "",
) -> dict[str, Any]:
    return {
        "id": attribute_id,
        "name": name,
        "description": description,
        "subject_types": ["sheet"],
        "value_type": "number",
        "default_value": _literal_attribute_value("number", default_value),
        "unit": unit,
        "visibility": "public",
        "validation_options": [],
        "reference_kind": None,
        "required": False,
        "required_profile": None,
        "backend_owned": True,
    }


def _migrate_v10_to_v11(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    attributes = state.setdefault("attributes", {})
    if not isinstance(attributes, dict):
        attributes = {}
        state["attributes"] = attributes

    definitions = (
        _sheet_attribute_definition(
            "level",
            "Level",
            1,
            description="Current character or creature level.",
        ),
        _sheet_attribute_definition(
            "movement",
            "Movement",
            30,
            description=(
                "Normal movement allocation for manual Roll20 play; this value is "
                "not enforced by the app."
            ),
            unit="feet",
        ),
        _sheet_attribute_definition(
            "mana_regeneration",
            "Mana Regeneration",
            10,
            description=(
                "Percent of maximum mana regenerated per hour. Time advancement "
                "and regeneration remain manual."
            ),
            unit="% max mana per hour",
        ),
    )
    for definition in definitions:
        attributes[definition["id"]] = definition

    return {"schema_version": 11, "state": state}


def _item_attribute_definition(
    attribute_id: str,
    name: str,
    value_type: str,
    default_value: Any,
    *,
    description: str,
    unit: str = "",
) -> dict[str, Any]:
    return {
        "id": attribute_id,
        "name": name,
        "description": description,
        "subject_types": ["item"],
        "value_type": value_type,
        "default_value": _literal_attribute_value(value_type, default_value),
        "unit": unit,
        "visibility": "public",
        "validation_options": [],
        "reference_kind": None,
        "required": False,
        "required_profile": None,
        "backend_owned": True,
    }


def _migrate_v11_to_v12(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    attributes = state.setdefault("attributes", {})
    if not isinstance(attributes, dict):
        attributes = {}
        state["attributes"] = attributes

    definitions = (
        _item_attribute_definition(
            "item_attribute",
            "Attribute",
            "text",
            "",
            description=(
                "Authored item attribute such as Fire. Display data unless an "
                "eligible action or augmentation explicitly consumes it."
            ),
        ),
        _item_attribute_definition(
            "item_mana_efficiency",
            "Mana Efficiency",
            "number",
            100,
            description=(
                "Authored mana-conductivity efficiency. This does not execute "
                "mana behavior by itself."
            ),
            unit="%",
        ),
        _item_attribute_definition(
            "item_flat_effect_bonus",
            "Flat Effect Bonus",
            "number",
            0,
            description=(
                "Flat bonus available as authored item data for eligible formulas "
                "or effects."
            ),
            unit="bonus",
        ),
        _item_attribute_definition(
            "item_mana_regeneration_modifier",
            "Mana Regeneration Modifier",
            "number",
            0,
            description=(
                "Authored mana-regeneration modifier. Time advancement and "
                "regeneration remain manual."
            ),
            unit="%",
        ),
    )
    for definition in definitions:
        attributes[definition["id"]] = definition

    return {"schema_version": 12, "state": state}


def _seeded_weapon_family_proficiency_payloads() -> dict[str, dict[str, Any]]:
    names = {
        "long_swords": "Long Swords",
        "short_swords": "Short Swords",
        "spears": "Spears",
        "shields": "Shields",
        "pugilists": "Pugilists",
        "staffs": "Staffs",
        "bows": "Bows",
        "throwing": "Throwing",
        "knives": "Knives",
        "axes": "Axes",
    }
    descriptions = {
        "long_swords": "Weapon-family proficiency for long sword use.",
        "short_swords": "Weapon-family proficiency for short sword use.",
        "spears": "Weapon-family proficiency for spear use.",
        "shields": "Weapon-family proficiency for shield use.",
        "pugilists": "Weapon-family proficiency for unarmed and pugilist use.",
        "staffs": "Weapon-family proficiency for staff use.",
        "bows": "Weapon-family proficiency for bow use.",
        "throwing": "Weapon-family proficiency for thrown weapon use.",
        "knives": "Weapon-family proficiency for knife use.",
        "axes": "Weapon-family proficiency for axe use.",
    }
    return {
        proficiency_id: {
            "id": proficiency_id,
            "name": names[proficiency_id],
            "description": descriptions[proficiency_id],
            "category": "weapon_family",
        }
        for proficiency_id in names
    }


def _migrate_v12_to_v13(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    proficiencies = state.setdefault("proficiencies", {})
    if not isinstance(proficiencies, dict):
        proficiencies = {}
        state["proficiencies"] = proficiencies

    seeded = _seeded_weapon_family_proficiency_payloads()
    for proficiency_id, proficiency in list(proficiencies.items()):
        if not isinstance(proficiency, dict):
            continue
        proficiency.setdefault(
            "category",
            "weapon_family" if proficiency_id in seeded else "custom",
        )

    for proficiency_id, proficiency in seeded.items():
        proficiencies.setdefault(proficiency_id, proficiency)

    return {"schema_version": 13, "state": state}


def _normalize_legacy_attribute_references(value: Any) -> Any:
    if isinstance(value, list):
        if value and value[0] == "facts":
            value[0] = "attributes"
        for entry in value:
            _normalize_legacy_attribute_references(entry)
        return value

    if not isinstance(value, dict):
        return value

    if "fact_id" in value and "attribute_id" not in value:
        value["attribute_id"] = value.pop("fact_id")
    else:
        value.pop("fact_id", None)

    relationship_id = value.get("relationship_id")
    if isinstance(relationship_id, str):
        value["relationship_id"] = relationship_id.replace(
            "required_fact_",
            "required_attribute_",
        ).replace("_fact", "_attribute")

    for entry in value.values():
        _normalize_legacy_attribute_references(entry)
    return value


def _merge_legacy_attribute_collection(owner: dict[str, Any]) -> None:
    legacy_attributes = owner.pop("facts", {})
    current_attributes = owner.get("attributes", {})
    if not isinstance(legacy_attributes, dict):
        legacy_attributes = {}
    if not isinstance(current_attributes, dict):
        current_attributes = {}
    owner["attributes"] = {
        **legacy_attributes,
        **current_attributes,
    }
    _normalize_legacy_attribute_references(owner["attributes"])


def _migrate_v13_to_v14(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    _merge_legacy_attribute_collection(state)

    for collection_name in ("sheets", "items", "actions"):
        collection = state.get(collection_name, {})
        if not isinstance(collection, dict):
            continue
        for entry in collection.values():
            if not isinstance(entry, dict):
                continue
            _merge_legacy_attribute_collection(entry)
            if collection_name == "items":
                if "fact_profile" in entry and "attribute_profile" not in entry:
                    entry["attribute_profile"] = entry.pop("fact_profile")
                else:
                    entry.pop("fact_profile", None)

    _normalize_legacy_attribute_references(state)
    return {"schema_version": 14, "state": state}


def _normalize_formula_path_references(value: Any) -> None:
    if isinstance(value, list):
        for entry in value:
            _normalize_formula_path_references(entry)
        return

    if not isinstance(value, dict):
        return

    path = value.get("path")
    if isinstance(path, list):
        value["path"] = [
            "attributes" if segment == "facts" else segment
            for segment in path
        ]

    for entry in value.values():
        _normalize_formula_path_references(entry)


def _proficiency_bridge_relationship_id(
    proficiencies: dict[str, Any],
    proficiency_id: str,
) -> str:
    base = f"weapon_proficiency_{proficiency_id}"
    existing = proficiencies.get(base)
    if not isinstance(existing, dict) or existing.get("prof_id") == proficiency_id:
        return base

    suffix = 2
    while True:
        candidate = f"{base}_{suffix}"
        existing = proficiencies.get(candidate)
        if not isinstance(existing, dict) or existing.get("prof_id") == proficiency_id:
            return candidate
        suffix += 1


def _weapon_attribute_value(item: dict[str, Any], attribute_id: str) -> Any:
    attributes = item.get("attributes")
    if not isinstance(attributes, dict):
        return None
    bridge = attributes.get(attribute_id)
    if not isinstance(bridge, dict) or bridge.get("evaluation_error") is not None:
        return None
    return bridge.get("evaluated_value", bridge.get("value", {}).get("value"))


def _sync_equipped_weapon_proficiencies_payload(state: dict[str, Any]) -> None:
    items = state.get("items", {})
    sheets = state.get("sheets", {})
    global_proficiencies = state.get("proficiencies", {})
    if (
        not isinstance(items, dict)
        or not isinstance(sheets, dict)
        or not isinstance(global_proficiencies, dict)
    ):
        return

    for sheet in sheets.values():
        if not isinstance(sheet, dict):
            continue
        sheet_items = sheet.get("items", {})
        sheet_proficiencies = sheet.setdefault("proficiencies", {})
        if not isinstance(sheet_items, dict) or not isinstance(sheet_proficiencies, dict):
            continue
        for item_bridge in sheet_items.values():
            if not isinstance(item_bridge, dict) or not item_bridge.get("equipped"):
                continue
            item = items.get(item_bridge.get("item_id"))
            if not isinstance(item, dict) or item.get("attribute_profile") != "weapon":
                continue
            proficiency_id = _weapon_attribute_value(item, "weapon_proficiency")
            growth_rate = _weapon_attribute_value(
                item,
                "weapon_proficiency_growth_rate",
            )
            if (
                not isinstance(proficiency_id, str)
                or not proficiency_id
                or proficiency_id not in global_proficiencies
            ):
                continue
            if (
                isinstance(growth_rate, bool)
                or not isinstance(growth_rate, int | float)
                or growth_rate < 0
            ):
                continue
            if any(
                isinstance(bridge, dict) and bridge.get("prof_id") == proficiency_id
                for bridge in sheet_proficiencies.values()
            ):
                continue
            relationship_id = _proficiency_bridge_relationship_id(
                sheet_proficiencies,
                proficiency_id,
            )
            sheet_proficiencies[relationship_id] = {
                "relationship_id": relationship_id,
                "prof_id": proficiency_id,
                "use_count": 0,
                "growth_rate": growth_rate,
            }


def _migrate_v14_to_v15(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    _normalize_formula_path_references(state)

    items = state.get("items", {})
    if isinstance(items, dict):
        for item in items.values():
            if not isinstance(item, dict) or item.get("attribute_profile") != "weapon":
                continue
            grants = item.get("action_grants", [])
            if not isinstance(grants, list):
                grants = []
            item["action_grants"] = normalize_weapon_action_grant_payloads(
                grant for grant in grants if isinstance(grant, dict)
            )

    sheets = state.get("sheets", {})
    if isinstance(sheets, dict):
        for sheet in sheets.values():
            if not isinstance(sheet, dict):
                continue
            actions = sheet.get("actions", {})
            if not isinstance(actions, dict):
                continue
            sheet["actions"] = {
                relationship_id: bridge
                for relationship_id, bridge in actions.items()
                if not (
                    isinstance(bridge, dict)
                    and bridge.get("entry_id") in WEAPON_ACTION_IDS
                )
            }

    _sync_equipped_weapon_proficiencies_payload(state)
    return {"schema_version": 15, "state": state}


def _restore_projected_base_value(
    state: dict[str, Any],
    target_path: str,
    base_value: Any,
) -> None:
    if not target_path.startswith("/"):
        return
    segments = [
        segment.replace("~1", "/").replace("~0", "~")
        for segment in target_path[1:].split("/")
    ]
    if not segments:
        return

    current: Any = state
    for segment in segments[:-1]:
        if isinstance(current, dict):
            current = current.get(segment)
        elif isinstance(current, list):
            try:
                current = current[int(segment)]
            except (IndexError, TypeError, ValueError):
                return
        else:
            return
        if current is None:
            return

    leaf = segments[-1]
    if isinstance(current, dict) and leaf in current:
        current[leaf] = deepcopy(base_value)
    elif isinstance(current, list):
        try:
            current[int(leaf)] = deepcopy(base_value)
        except (IndexError, TypeError, ValueError):
            return


def _migrate_v15_to_v16(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])

    projections = state.get("equipment_effect_projections", {})
    if isinstance(projections, dict):
        for projection in projections.values():
            if not isinstance(projection, dict):
                continue
            target_path = projection.get("target_path")
            if isinstance(target_path, str) and "base_value" in projection:
                _restore_projected_base_value(
                    state,
                    target_path,
                    projection["base_value"],
                )
    state["equipment_effect_projections"] = {}

    augmentations = state.get("augmentations")
    equipment_augmentation_ids: set[str] = set()
    if isinstance(augmentations, dict):
        equipment_augmentation_ids = {
            augmentation_id
            for augmentation_id, augmentation in augmentations.items()
            if isinstance(augmentation, dict)
            and augmentation.get("lifecycle_owner") == "equipment"
        }
        state["augmentations"] = {
            augmentation_id: augmentation
            for augmentation_id, augmentation in augmentations.items()
            if augmentation_id not in equipment_augmentation_ids
        }

    sheets = state.get("sheets", {})
    instances = state.get("instanced_sheets", {})
    if isinstance(sheets, dict) and isinstance(instances, dict):
        for instance in instances.values():
            if not isinstance(instance, dict):
                continue
            template = sheets.get(instance.get("parent_id"))
            if not isinstance(template, dict):
                continue
            instance.setdefault("items", deepcopy(template.get("items", {})))
            instance.setdefault("stats", deepcopy(template.get("stats", {})))
            augments = instance.get("augments", {})
            if isinstance(augments, dict):
                instance["augments"] = {
                    relationship_id: bridge
                    for relationship_id, bridge in augments.items()
                    if not (
                        relationship_id in equipment_augmentation_ids
                        or (
                            isinstance(bridge, dict)
                            and bridge.get("entry_id") in equipment_augmentation_ids
                        )
                    )
                }

    return {"schema_version": 16, "state": state}


def _migrate_v16_to_v17(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    sheets = state.get("sheets", {})
    instances = state.get("instanced_sheets", {})
    if isinstance(sheets, dict) and isinstance(instances, dict):
        for instance in instances.values():
            if not isinstance(instance, dict):
                continue
            template = sheets.get(instance.get("parent_id"))
            if not isinstance(template, dict):
                continue
            instance.setdefault("actions", deepcopy(template.get("actions", {})))
            instance.setdefault("attributes", deepcopy(template.get("attributes", {})))
            instance.setdefault(
                "proficiencies",
                deepcopy(template.get("proficiencies", {})),
            )

    return {"schema_version": 17, "state": state}


def _migrate_v17_to_v18(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    state["parties"] = {}
    state["kill_registry"] = {}
    state["xp_adjustments"] = {}

    sheets = state.get("sheets", {})
    if isinstance(sheets, dict):
        for sheet in sheets.values():
            if not isinstance(sheet, dict):
                continue
            sheet.pop("slayed_record", None)
            for field_name in ("xp_given_when_slayed", "xp_cap"):
                try:
                    value = Decimal(str(sheet.get(field_name, 0)))
                    if not value.is_finite():
                        raise InvalidOperation
                    sheet[field_name] = float(
                        value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    )
                except (InvalidOperation, ValueError):
                    sheet[field_name] = 0.0

    # The projection collection is no longer equipment-only: it also backs
    # standalone/action-controlled direct effects. Rename the persisted key to
    # match, preserving any populated projections.
    if "equipment_effect_projections" in state:
        state["direct_effect_projections"] = state.pop("equipment_effect_projections")
    else:
        state.setdefault("direct_effect_projections", {})
    return {"schema_version": 18, "state": state}


def _migrate_v18_to_v19(envelope: PersistedEnvelope) -> PersistedEnvelope:
    # Condition presets are pure definitions: their effects are authored inline as
    # augmentation_templates. The parallel augmentation_ids list was never consumed by
    # the apply path, so drop it. (ActiveCondition.augmentation_ids remains — that is the
    # live per-application list.)
    state = deepcopy(envelope["state"])
    # Version 18 existed independently on both sides of the merge. Make this
    # rename idempotent so checkpoints written by either history upgrade safely.
    if "equipment_effect_projections" in state:
        state["direct_effect_projections"] = state.pop("equipment_effect_projections")
    else:
        state.setdefault("direct_effect_projections", {})
    presets = state.get("condition_presets", {})
    if isinstance(presets, dict):
        for preset in presets.values():
            if isinstance(preset, dict):
                preset.pop("augmentation_ids", None)
    return {"schema_version": 19, "state": state}


def _migrate_v19_to_v20(envelope: PersistedEnvelope) -> PersistedEnvelope:
    # Active conditions gained source/timing metadata (why/who/when applied). Backfill
    # explicit defaults for pre-existing applications; their true origin is unknown.
    state = deepcopy(envelope["state"])
    active_conditions = state.get("active_conditions", {})
    if isinstance(active_conditions, dict):
        for active_condition in active_conditions.values():
            if not isinstance(active_condition, dict):
                continue
            active_condition.setdefault("source", {"type": "other", "id": None, "label": None})
            active_condition.setdefault("applied_at", None)
            active_condition.setdefault("applied_by_role", None)
            active_condition.setdefault("applied_at_state_version", None)
    return {"schema_version": 20, "state": state}


def _iter_dicts(collection: Any) -> list[dict]:
    if not isinstance(collection, dict):
        return []
    return [value for value in collection.values() if isinstance(value, dict)]


def _upgrade_lifecycle_dict(lifecycle: Any) -> None:
    # Old shape: {duration, expires_at, removal_condition} (all free text, notes-only).
    # New shape: {mode, remaining, expires_at, remove_when_source_inactive, notes}. Old free
    # text can't be reliably parsed into a mode, so preserve it in `notes` and default to manual.
    if not isinstance(lifecycle, dict) or "mode" in lifecycle:
        return
    duration = lifecycle.pop("duration", None)
    removal_condition = lifecycle.pop("removal_condition", None)
    note_parts = [
        str(part).strip()
        for part in (duration, removal_condition)
        if isinstance(part, str) and part.strip()
    ]
    lifecycle["mode"] = "manual"
    lifecycle["remaining"] = None
    lifecycle.setdefault("expires_at", None)
    lifecycle["remove_when_source_inactive"] = False
    lifecycle["notes"] = " / ".join(note_parts) if note_parts else None


def _migrate_v20_to_v21(envelope: PersistedEnvelope) -> PersistedEnvelope:
    # Structure the augmentation lifecycle: descriptive free-text fields become an explicit
    # (declarative) mode + counter. Applies everywhere a lifecycle is persisted.
    state = deepcopy(envelope["state"])

    for augmentation in _iter_dicts(state.get("augmentations")):
        _upgrade_lifecycle_dict(augmentation.get("lifecycle"))

    for definition in _iter_dicts(state.get("standalone_effects")):
        _upgrade_lifecycle_dict(definition.get("lifecycle"))

    for preset in _iter_dicts(state.get("condition_presets")):
        for template in preset.get("augmentation_templates", []) or []:
            if isinstance(template, dict):
                _upgrade_lifecycle_dict(template.get("lifecycle"))

    for item in _iter_dicts(state.get("items")):
        for template in item.get("augmentation_templates", []) or []:
            if isinstance(template, dict):
                _upgrade_lifecycle_dict(template.get("lifecycle"))

    return {"schema_version": 21, "state": state}


def _migrate_v21_to_v22(envelope: PersistedEnvelope) -> PersistedEnvelope:
    # Standalone effects gained a declarative stacking config; applications gained a stack index.
    state = deepcopy(envelope["state"])
    for definition in _iter_dicts(state.get("standalone_effects")):
        definition.setdefault("stacking", {"mode": "unique", "max_stacks": None})
    for application in _iter_dicts(state.get("standalone_effect_applications")):
        application.setdefault("stack_index", 0)
    return {"schema_version": 22, "state": state}


def _formula_payload(text: str, aliases: list[tuple[str, list[str]]]) -> dict[str, Any]:
    return {
        "text": text,
        "aliases": [
            {"name": name, "path": path}
            for name, path in aliases
        ],
        "tags": [],
    }


def _corrected_health_formula_payload() -> dict[str, Any]:
    return _formula_payload(
        "floor(@constitution)",
        [("constitution", ["stats", "constitution"])],
    )


def _corrected_mana_formula_payload() -> dict[str, Any]:
    return _formula_payload(
        "floor(@arcane)",
        [("arcane", ["stats", "arcane"])],
    )


_LEGACY_STAT_NAMES = {
    "strength",
    "dexterity",
    "constitution",
    "perception",
    "arcane",
    "will",
    "lifting",
    "carry_weight",
    "acrobatics",
    "stamina",
    "reaction_time",
    "health",
    "endurance",
    "pain_tolerance",
    "sight_distance",
    "intuition",
    "registration",
    "mana",
    "control",
    "sensitivity",
    "charisma",
    "mental_fortitude",
    "courage",
}


def _normalize_legacy_resource_formula(value: Any) -> dict[str, Any]:
    formula = deepcopy(value) if isinstance(value, dict) else {"text": str(value)}
    aliases = formula.get("aliases")
    if isinstance(aliases, list):
        for alias in aliases:
            if not isinstance(alias, dict):
                continue
            path = alias.get("path")
            if (
                isinstance(path, list)
                and len(path) == 1
                and path[0] in _LEGACY_STAT_NAMES
            ):
                alias["path"] = ["stats", path[0]]
    else:
        text = formula.get("text", "")
        names = sorted(
            name
            for name in set(re.findall(r"@([A-Za-z_][A-Za-z0-9_]*)", text))
            if name in _LEGACY_STAT_NAMES
        )
        formula["aliases"] = [
            {"name": name, "path": ["stats", name]}
            for name in names
        ] or None
    formula.setdefault("tags", [])
    return formula


def _rewrite_resource_bound_formula_aliases(value: Any) -> None:
    if isinstance(value, list):
        for entry in value:
            _rewrite_resource_bound_formula_aliases(entry)
        return
    if not isinstance(value, dict):
        return

    aliases = value.get("aliases")
    if isinstance(aliases, list):
        for alias in aliases:
            if not isinstance(alias, dict):
                continue
            path = alias.get("path")
            if path == ["stats", "health"]:
                alias["path"] = ["max_health"]
            elif path == ["stats", "mana"]:
                alias["path"] = ["max_mana"]

    for entry in value.values():
        _rewrite_resource_bound_formula_aliases(entry)


def _rewrite_legacy_action_resource_bounds(value: Any) -> None:
    if isinstance(value, list):
        for entry in value:
            _rewrite_legacy_action_resource_bounds(entry)
        return
    if not isinstance(value, dict):
        return

    for key, entry in value.items():
        if key == "max_value":
            _rewrite_resource_bound_formula_aliases(entry)
        else:
            _rewrite_legacy_action_resource_bounds(entry)


def _migrate_v22_to_v23(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    # Version 23 was independently used for XP tracking and resource formulas.
    # Apply both shape changes here so version-22 checkpoints receive both.
    state.setdefault("parties", {})
    state.setdefault("kill_registry", {})
    state.setdefault("xp_adjustments", {})

    sheets = state.get("sheets", {})
    legacy_maxima: dict[str, tuple[dict[str, Any], dict[str, Any]]] = {}

    if isinstance(sheets, dict):
        for sheet_id, sheet in sheets.items():
            if not isinstance(sheet, dict):
                continue
            sheet.pop("slayed_record", None)
            for field_name in ("xp_given_when_slayed", "xp_cap"):
                try:
                    value = Decimal(str(sheet.get(field_name, 0)))
                    if not value.is_finite():
                        raise InvalidOperation
                    sheet[field_name] = float(
                        value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    )
                except (InvalidOperation, ValueError):
                    sheet[field_name] = 0.0
            stats = sheet.get("stats")
            if not isinstance(stats, dict):
                continue
            legacy_health = _normalize_legacy_resource_formula(
                stats.get("health", _corrected_health_formula_payload())
            )
            legacy_mana = _normalize_legacy_resource_formula(
                stats.get("mana", _corrected_mana_formula_payload())
            )
            legacy_maxima[sheet_id] = (legacy_health, legacy_mana)
            sheet.setdefault("racial_hp_multiplier", 1.0)
            sheet.setdefault("max_health", legacy_health)
            sheet.setdefault("max_mana", legacy_mana)
            sheet.setdefault("stat_bonuses", {})
            stats["health"] = _corrected_health_formula_payload()
            stats["mana"] = _corrected_mana_formula_payload()

    instances = state.get("instanced_sheets", {})
    if isinstance(instances, dict):
        for instance in instances.values():
            if not isinstance(instance, dict):
                continue
            parent_id = instance.get("parent_id")
            parent_maxima = legacy_maxima.get(parent_id)
            stats = instance.get("stats")
            if isinstance(stats, dict):
                legacy_health = _normalize_legacy_resource_formula(
                    stats.get(
                        "health",
                        parent_maxima[0]
                        if parent_maxima is not None
                        else _corrected_health_formula_payload(),
                    )
                )
                legacy_mana = _normalize_legacy_resource_formula(
                    stats.get(
                        "mana",
                        parent_maxima[1]
                        if parent_maxima is not None
                        else _corrected_mana_formula_payload(),
                    )
                )
                stats["health"] = _corrected_health_formula_payload()
                stats["mana"] = _corrected_mana_formula_payload()
            else:
                legacy_health = _normalize_legacy_resource_formula(
                    parent_maxima[0]
                    if parent_maxima is not None
                    else _corrected_health_formula_payload()
                )
                legacy_mana = _normalize_legacy_resource_formula(
                    parent_maxima[1]
                    if parent_maxima is not None
                    else _corrected_mana_formula_payload()
                )
            instance.setdefault("racial_hp_multiplier", 1.0)
            instance.setdefault("max_health", legacy_health)
            instance.setdefault("max_mana", legacy_mana)
            instance.setdefault("stat_bonuses", {})

    _rewrite_legacy_action_resource_bounds(state.get("actions", {}))
    return {"schema_version": 23, "state": state}


def _migrate_v23_to_v24(envelope: PersistedEnvelope) -> PersistedEnvelope:
    # Existing version-23 checkpoints may come from either pre-merge history.
    # The version-23 migration is idempotent, so replay it to converge their shapes.
    migrated = _migrate_v22_to_v23(
        {"schema_version": 22, "state": envelope["state"]}
    )
    return {"schema_version": 24, "state": migrated["state"]}


_LEGACY_WEIGHT_PATTERN = re.compile(
    r"^\+?(?:\d+(?:\.\d*)?|\.\d+)\s*(?:lb|lbs|pound|pounds)?$",
    re.IGNORECASE,
)


def _migrate_legacy_weight(item_id: str, value: Any) -> float:
    if isinstance(value, bool):
        raise PersistedStateError(f"Item '{item_id}' has invalid legacy weight.")
    if isinstance(value, int | float):
        weight = float(value)
    elif isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return 0.0
        if _LEGACY_WEIGHT_PATTERN.fullmatch(normalized) is None:
            raise PersistedStateError(
                f"Item '{item_id}' has unsupported legacy weight '{value}'."
            )
        number = re.match(r"^\+?(?:\d+(?:\.\d*)?|\.\d+)", normalized)
        if number is None:
            raise PersistedStateError(f"Item '{item_id}' has invalid legacy weight.")
        weight = float(number.group(0))
    else:
        raise PersistedStateError(f"Item '{item_id}' has invalid legacy weight.")
    if not isfinite(weight) or weight < 0:
        raise PersistedStateError(
            f"Item '{item_id}' weight must be finite and nonnegative."
        )
    return weight


def _migrate_v24_to_v25(envelope: PersistedEnvelope) -> PersistedEnvelope:
    # Version 24 existed on both sides of the merge. Replay the idempotent
    # resource/stat convergence before applying inventory normalization so
    # checkpoints written by either history reach the same version-25 shape.
    converged = _migrate_v22_to_v23(
        {"schema_version": 22, "state": envelope["state"]}
    )
    state = deepcopy(converged["state"])
    items = state.get("items", {})
    if isinstance(items, dict):
        for item_id, item in items.items():
            if not isinstance(item, dict):
                continue
            item["weight"] = _migrate_legacy_weight(
                str(item_id),
                item.get("weight", ""),
            )
            item.setdefault("can_contain_items", False)
            item.setdefault("contents_weight_behavior", "normal")

    for collection_name in ("sheets", "instanced_sheets"):
        sheets = state.get(collection_name, {})
        if not isinstance(sheets, dict):
            continue
        for sheet in sheets.values():
            if not isinstance(sheet, dict):
                continue
            inventory = sheet.get("items")
            if not isinstance(inventory, dict):
                continue
            for bridge in inventory.values():
                if isinstance(bridge, dict):
                    bridge.setdefault("parent_container_id", None)

    return {"schema_version": 25, "state": state}


def _legacy_weapon_roll_payload(action_id: str) -> dict[str, Any]:
    payload = _legacy_v29_canonical_payloads()[action_id]
    message = payload["steps"][0]["message"]
    if action_id == "weapon_parry":
        payload["notes"] = (
            "Spreadsheet Weapon Parry attempt: proficiency times d100 fraction "
            "times Dexterity. This intentionally differs from the prose Parry rule."
        )
        message["text"] = (
            "Weapon Parry: /r floor(@weapon_proficiency * "
            "(1d100 / 100) * @dexterity)"
        )
    else:
        message["text"] = (
            "Weapon Contest: /r floor(@weapon_proficiency * "
            "(1d100 / 100) * @weapon_stat)"
        )
    return payload


def _migrate_v25_to_v26(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    actions = state.get("actions")
    if isinstance(actions, dict):
        canonical = _legacy_v29_canonical_payloads()
        for action_id in ("weapon_parry", "weapon_contest"):
            if actions.get(action_id) == _legacy_weapon_roll_payload(action_id):
                actions[action_id] = canonical[action_id]
    return {"schema_version": 26, "state": state}


def _migrate_v26_to_v27(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    state.setdefault("player_kill_visibility", {})
    kill_registry = state.get("kill_registry")
    if isinstance(kill_registry, dict):
        for kill in kill_registry.values():
            if not isinstance(kill, dict):
                continue
            kill.setdefault("submitted_by_role", "dm")
            kill.setdefault("submitted_by_instance_id", None)
            kill.setdefault("submitted_by_name", None)
    return {"schema_version": 27, "state": state}


def _migrate_v27_to_v28(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    items = state.get("items", {})
    if isinstance(items, dict):
        for item in items.values():
            if not isinstance(item, dict):
                continue
            item.setdefault("player_visible", True)
            item.setdefault("approval_status", "approved")
            item.setdefault("submitted_by_instance_id", None)
            item.setdefault("submitted_by_name", None)
    return {"schema_version": 28, "state": state}


def _migrate_v28_to_v29(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    actions = state.get("actions", {})
    if isinstance(actions, dict):
        for action in actions.values():
            if not isinstance(action, dict):
                continue
            steps = action.get("steps", [])
            if not isinstance(steps, list):
                continue
            for step in steps:
                if isinstance(step, dict) and step.get("type") == "send_message":
                    step.setdefault("visibility", "public")
    return {"schema_version": 29, "state": state}


def _legacy_v29_canonical_payloads() -> dict[str, dict[str, Any]]:
    return {
        preset.id: {
            "id": preset.id,
            "name": preset.label,
            "roll_mode_kind": preset.roll_mode_kind,
            "notes": preset.description,
            "steps": [
                {
                    "step_id": "roll",
                    "type": "send_message",
                    "visibility": "public",
                    "message": {
                        "aliases": [
                            {"name": name, "path": list(path)}
                            for name, path in preset.aliases
                        ],
                        "text": preset.message_text,
                        "tags": list(preset.tags),
                    },
                }
            ],
            "attributes": {},
        }
        for preset in CANONICAL_ACTION_PRESETS
        if preset.seed_global
    }


def _legacy_v29_baseline_payloads() -> dict[str, dict[str, Any]]:
    return {
        f"baseline_check_{stat_name}": {
            "id": f"baseline_check_{stat_name}",
            "name": f"{label} Check",
            "roll_mode_kind": "check",
            "notes": "Default baseline sheet check. Emits a Roll20 d100 stat check.",
            "steps": [
                {
                    "step_id": "roll",
                    "type": "send_message",
                    "visibility": "public",
                    "message": {
                        "aliases": [{"name": stat_name, "path": ["stats", stat_name]}],
                        "text": f"{label} Check: /r (1d100 / 100) * @{stat_name}",
                        "tags": [],
                    },
                }
            ],
            "attributes": {},
        }
        for stat_name, label in BASELINE_SHEET_CHECKS
    }


def _migrate_v29_to_v30(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    actions = state.get("actions")
    if isinstance(actions, dict):
        replacements = seeded_global_action_payloads()
        legacy = {
            **_legacy_v29_canonical_payloads(),
            **_legacy_v29_baseline_payloads(),
        }
        for action_id, old_payload in legacy.items():
            if actions.get(action_id) != old_payload:
                continue
            if action_id in replacements:
                actions[action_id] = replacements[action_id]
                continue
            stat_name = action_id.removeprefix("baseline_check_")
            label = dict(BASELINE_SHEET_CHECKS)[stat_name]
            replacement = deepcopy(old_payload)
            replacement["steps"] = [
                {
                    "step_id": "roll",
                    "type": "send_roll",
                    "title": f"{label} Check",
                    "presentation": "simple",
                    "visibility": "public",
                    "rolls": [
                        {
                            "label": "Result",
                            "value": {
                                "aliases": [
                                    {"name": stat_name, "path": ["stats", stat_name]}
                                ],
                                "text": f"(1d100 / 100) * @{stat_name}",
                                "tags": [],
                            },
                        }
                    ],
                }
            ]
            actions[action_id] = replacement
    return {"schema_version": 30, "state": state}


MIGRATIONS: dict[int, Migration] = {
    0: _migrate_v0_to_v1,
    1: _migrate_v1_to_v2,
    2: _migrate_v2_to_v3,
    3: _migrate_v3_to_v4,
    4: _migrate_v4_to_v5,
    5: _migrate_v5_to_v6,
    6: _migrate_v6_to_v7,
    7: _migrate_v7_to_v8,
    8: _migrate_v8_to_v9,
    9: _migrate_v9_to_v10,
    10: _migrate_v10_to_v11,
    11: _migrate_v11_to_v12,
    12: _migrate_v12_to_v13,
    13: _migrate_v13_to_v14,
    14: _migrate_v14_to_v15,
    15: _migrate_v15_to_v16,
    16: _migrate_v16_to_v17,
    17: _migrate_v17_to_v18,
    18: _migrate_v18_to_v19,
    19: _migrate_v19_to_v20,
    20: _migrate_v20_to_v21,
    21: _migrate_v21_to_v22,
    22: _migrate_v22_to_v23,
    23: _migrate_v23_to_v24,
    24: _migrate_v24_to_v25,
    25: _migrate_v25_to_v26,
    26: _migrate_v26_to_v27,
    27: _migrate_v27_to_v28,
    28: _migrate_v28_to_v29,
    29: _migrate_v29_to_v30,
}


def build_persisted_state(state: dict[str, Any]) -> PersistedEnvelope:
    return {
        "schema_version": CURRENT_STATE_SCHEMA_VERSION,
        "state": state,
    }


def migrate_persisted_state(raw: Any) -> StateMigrationResult:
    if not isinstance(raw, dict):
        raise PersistedStateError("Persisted state must be a JSON object.")

    if "schema_version" not in raw:
        envelope: PersistedEnvelope = {
            "schema_version": 0,
            "state": raw,
        }
    else:
        version = raw.get("schema_version")
        state = raw.get("state")
        if not isinstance(version, int) or isinstance(version, bool):
            raise PersistedStateError("Persisted state schema_version must be an integer.")
        if not isinstance(state, dict):
            raise PersistedStateError("Persisted state envelope must contain an object state.")
        envelope = {
            "schema_version": version,
            "state": state,
        }

    source_version = envelope["schema_version"]
    if source_version > CURRENT_STATE_SCHEMA_VERSION:
        raise PersistedStateError(
            "Persisted state schema version "
            f"{source_version} is newer than supported version "
            f"{CURRENT_STATE_SCHEMA_VERSION}."
        )

    while envelope["schema_version"] < CURRENT_STATE_SCHEMA_VERSION:
        version = envelope["schema_version"]
        migration = MIGRATIONS.get(version)
        if migration is None:
            raise PersistedStateError(
                f"No persisted state migration is registered for version {version}."
            )
        envelope = migration(envelope)

    state = envelope.get("state")
    if not isinstance(state, dict):
        raise PersistedStateError("Migrated persisted state must contain an object state.")

    return StateMigrationResult(
        state=state,
        source_version=source_version,
        migrated=source_version != CURRENT_STATE_SCHEMA_VERSION,
    )
