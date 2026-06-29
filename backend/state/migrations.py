from __future__ import annotations

from collections.abc import Callable
from copy import deepcopy
from dataclasses import dataclass
from typing import Any

CURRENT_STATE_SCHEMA_VERSION = 3

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
            category = _legacy_description_value(description, "Type")
            rank = _legacy_description_value(description, "Rank")
            effect_text_present = any(
                _legacy_description_value(description, label)
                for label in ("Immediate Effects", "Non-Immediate Effects")
            )

            retained_lines = [
                line
                for line in description.splitlines()
                if not line.strip().startswith(("Type:", "Rank:"))
            ]
            item["description"] = "\n".join(retained_lines).strip()
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


MIGRATIONS: dict[int, Migration] = {
    0: _migrate_v0_to_v1,
    1: _migrate_v1_to_v2,
    2: _migrate_v2_to_v3,
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
