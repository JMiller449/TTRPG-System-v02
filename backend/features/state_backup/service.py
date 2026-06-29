from __future__ import annotations

import json
from typing import Any

from backend.features.session.models import WebSocketSession
from backend.features.state_backup.schema import StateBackupExported
from backend.features.state_sync.service import state_sync_service
from backend.features.augmentations.service import (
    synchronize_equipment_augmentations_mutation,
)
from backend.state.migrations import (
    CURRENT_STATE_SCHEMA_VERSION,
    PersistedStateError,
    migrate_persisted_state,
)
from backend.state.models.state import State
from backend.state.store import StateSingleton


def export_state_backup(*, request_id: str | None = None) -> StateBackupExported:
    persisted_state = StateSingleton.exportPersistedState()
    return StateBackupExported(
        response_id=None,
        persisted_state_json=json.dumps(persisted_state, indent=2, sort_keys=True),
        schema_version=CURRENT_STATE_SCHEMA_VERSION,
        request_id=request_id,
    )


def _parse_import_payload(persisted_state_json: str) -> Any:
    try:
        return json.loads(persisted_state_json)
    except json.JSONDecodeError as exc:
        raise PersistedStateError("Imported state backup is not valid JSON.") from exc


async def import_state_backup(
    session: WebSocketSession,
    *,
    persisted_state_json: str,
    request_id: str | None = None,
) -> None:
    migration = migrate_persisted_state(_parse_import_payload(persisted_state_json))
    try:
        imported_state = State.from_dict(migration.state)
        synchronize_equipment_augmentations_mutation(imported_state)
    except (TypeError, ValueError, KeyError) as exc:
        raise PersistedStateError("Imported state backup does not match the state schema.") from exc

    await state_sync_service.replace_state_and_broadcast_snapshots(
        imported_state,
        requesting_session=session,
        request_id=request_id,
    )
