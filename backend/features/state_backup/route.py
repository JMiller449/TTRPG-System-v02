from __future__ import annotations

from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.session.models import WebSocketSession
from backend.features.state_backup import handler
from backend.features.state_backup.schema import ExportStateBackup, ImportStateBackup
from backend.protocol.socket import StateBackupExportedEvent, StateSnapshotEvent


class ExportStateBackupRoute(RequestRoute[ExportStateBackup]):
    type_name = "export_state_backup"
    request_model = ExportStateBackup
    emitted_event_models = (StateBackupExportedEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="stateBackup",
        method_name="exportStateBackup",
    )

    async def handle(self, session: WebSocketSession, request: ExportStateBackup) -> None:
        await handler.handle_export_state_backup(session, request)


class ImportStateBackupRoute(RequestRoute[ImportStateBackup]):
    type_name = "import_state_backup"
    request_model = ImportStateBackup
    emitted_event_models = (StateSnapshotEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="stateBackup",
        method_name="importStateBackup",
    )

    async def handle(self, session: WebSocketSession, request: ImportStateBackup) -> None:
        await handler.handle_import_state_backup(session, request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(ExportStateBackupRoute())
    registry.register(ImportStateBackupRoute())
