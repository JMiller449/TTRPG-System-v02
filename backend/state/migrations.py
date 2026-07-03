from __future__ import annotations

from collections.abc import Callable
from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from backend.state.default_actions import seeded_global_action_payloads

CURRENT_STATE_SCHEMA_VERSION = 10

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
    facts = state.setdefault("facts", {})
    if not isinstance(facts, dict):
        facts = {}
        state["facts"] = facts
    facts["amount_of_reactions"] = {
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
            sheet_facts = sheet.setdefault("facts", {})
            if not isinstance(sheet_facts, dict):
                sheet_facts = {}
                sheet["facts"] = sheet_facts
            sheet_facts.setdefault(
                "amount_of_reactions",
                {
                    "relationship_id": "required_fact_amount_of_reactions",
                    "fact_id": "amount_of_reactions",
                    "value": _amount_of_reactions_formula_payload(),
                    "evaluated_value": None,
                    "evaluation_error": None,
                },
            )

    return {"schema_version": 7, "state": state}


def _literal_fact_value(value_type: str, value: Any) -> dict[str, Any]:
    return {"type": value_type, "value": value, "formula": None}


def _weapon_fact_definition(
    fact_id: str,
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
        "id": fact_id,
        "name": name,
        "description": description,
        "subject_types": ["item"],
        "value_type": value_type,
        "default_value": _literal_fact_value(value_type, default_value),
        "unit": unit,
        "visibility": "public",
        "validation_options": validation_options or [],
        "reference_kind": reference_kind,
        "required": True,
        "required_profile": "weapon",
    }


def _migrate_v7_to_v8(envelope: PersistedEnvelope) -> PersistedEnvelope:
    state = deepcopy(envelope["state"])
    facts = state.setdefault("facts", {})
    if not isinstance(facts, dict):
        facts = {}
        state["facts"] = facts
    for definition in facts.values():
        if isinstance(definition, dict):
            definition.setdefault("required_profile", None)

    weapon_definitions = (
        _weapon_fact_definition(
            "weapon_type",
            "Weapon Type",
            "text",
            "",
            description="Authored weapon family or form, such as Sword or Bow.",
        ),
        _weapon_fact_definition(
            "weapon_base_damage",
            "Base Damage",
            "number",
            0,
            description="Flat weapon damage used by eligible weapon actions.",
            unit="damage",
        ),
        _weapon_fact_definition(
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
        _weapon_fact_definition(
            "weapon_damage_types",
            "Physical Damage Types",
            "list",
            [],
            description="Physical damage types this weapon can deal.",
            validation_options=["Slashing", "Bludgeoning", "Piercing"],
        ),
        _weapon_fact_definition(
            "weapon_reach",
            "Reach",
            "number",
            0,
            description="Authored reach for display and future eligible actions.",
        ),
        _weapon_fact_definition(
            "weapon_proficiency",
            "Proficiency",
            "reference",
            "",
            description="Proficiency definition used by eligible weapon actions.",
            reference_kind="proficiency",
        ),
        _weapon_fact_definition(
            "weapon_proficiency_growth_rate",
            "Proficiency Growth Rate",
            "number",
            0,
            description="Growth rate supplied when this weapon grants proficiency use.",
        ),
    )
    for definition in weapon_definitions:
        facts[definition["id"]] = definition

    items = state.get("items", {})
    if isinstance(items, dict):
        for item in items.values():
            if isinstance(item, dict):
                item.setdefault("fact_profile", None)
                item.setdefault("facts", {})

    return {"schema_version": 8, "state": state}


def _action_fact_definition(
    fact_id: str,
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
        "id": fact_id,
        "name": name,
        "description": description,
        "subject_types": ["action"],
        "value_type": value_type,
        "default_value": _literal_fact_value(value_type, default_value),
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
    facts = state.setdefault("facts", {})
    if not isinstance(facts, dict):
        facts = {}
        state["facts"] = facts
    for definition in facts.values():
        if isinstance(definition, dict):
            definition.setdefault("backend_owned", False)
    for fact_id in (
        "amount_of_reactions",
        "weapon_type",
        "weapon_base_damage",
        "weapon_governing_stat",
        "weapon_damage_types",
        "weapon_reach",
        "weapon_proficiency",
        "weapon_proficiency_growth_rate",
    ):
        definition = facts.get(fact_id)
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
        _action_fact_definition(
            "action_rank",
            "Rank",
            "enum",
            "F",
            description="Authored action or skill rank.",
            validation_options=rank_options,
        ),
        _action_fact_definition(
            "action_range",
            "Range",
            "number",
            0,
            description=(
                "Informational action range unless a step explicitly consumes it."
            ),
        ),
        _action_fact_definition(
            "action_target_count",
            "Target Count",
            "number",
            1,
            description="Informational target count; it does not enforce targeting.",
            unit="targets",
        ),
        _action_fact_definition(
            "action_area",
            "Area",
            "text",
            "",
            description="Informational area or shape description.",
        ),
        _action_fact_definition(
            "action_mana_cost",
            "Mana Cost",
            "number",
            0,
            description=(
                "Authored mana cost; no resource change occurs unless a step uses it."
            ),
            unit="mana",
        ),
        _action_fact_definition(
            "action_base_spell_damage",
            "Base Spell Damage",
            "number",
            0,
            description="Flat spell damage available to eligible spell formulas.",
            unit="damage",
        ),
        _action_fact_definition(
            "action_proficiency",
            "Proficiency",
            "reference",
            "",
            description="Proficiency definition used by eligible action formulas.",
            reference_kind="proficiency",
        ),
    )
    for definition in action_definitions:
        facts[definition["id"]] = definition

    for action in state.get("actions", {}).values():
        if isinstance(action, dict):
            action.setdefault("facts", {})

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
