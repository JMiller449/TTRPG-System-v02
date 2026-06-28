from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

CURRENT_STATE_SCHEMA_VERSION = 1


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


MIGRATIONS: dict[int, Migration] = {
    0: _migrate_v0_to_v1,
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
