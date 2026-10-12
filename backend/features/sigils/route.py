from backend.core.request_registry import ClientGenerationMetadata, RequestRegistry, RequestRoute
from backend.features.session.models import WebSocketSession
from backend.features.session.service import websocket_sessions
from backend.protocol.socket import ActionExecutedEvent, StatePatchEvent
from . import service
from .schema import (
    ActivateSigil, DeleteSigil, DischargeSigil, DuplicateSigil, ImbueSigil,
    PreviewSigil, SaveSigil, SetSigilAuthoringAccess, SigilPreview,
)


class SetSigilAuthoringAccessRoute(RequestRoute[SetSigilAuthoringAccess]):
    type_name = "set_sigil_authoring_access"
    request_model = SetSigilAuthoringAccess
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(namespace="sigils", method_name="setAuthoringAccess")

    async def handle(self, session: WebSocketSession, request: SetSigilAuthoringAccess) -> None:
        await service.set_authoring_access(request, session.role)


class SaveSigilRoute(RequestRoute[SaveSigil]):
    type_name = "save_sigil"
    request_model = SaveSigil
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(namespace="sigils", method_name="save")

    async def handle(self, session: WebSocketSession, request: SaveSigil) -> None:
        await service.save(request, session.role, session.assigned_instance_id)


class DeleteSigilRoute(RequestRoute[DeleteSigil]):
    type_name = "delete_sigil"
    request_model = DeleteSigil
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(namespace="sigils", method_name="delete")

    async def handle(self, session: WebSocketSession, request: DeleteSigil) -> None:
        await service.manage(request, session.role, session.assigned_instance_id)


class DuplicateSigilRoute(RequestRoute[DuplicateSigil]):
    type_name = "duplicate_sigil"
    request_model = DuplicateSigil
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(namespace="sigils", method_name="duplicate")

    async def handle(self, session: WebSocketSession, request: DuplicateSigil) -> None:
        await service.manage(request, session.role, session.assigned_instance_id)


class ImbueSigilRoute(RequestRoute[ImbueSigil]):
    type_name = "imbue_sigil"
    request_model = ImbueSigil
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(namespace="sigils", method_name="imbue")

    async def handle(self, session: WebSocketSession, request: ImbueSigil) -> None:
        await service.imbue(request, session.role, session.assigned_instance_id)


class DischargeSigilRoute(RequestRoute[DischargeSigil]):
    type_name = "discharge_sigil"
    request_model = DischargeSigil
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(namespace="sigils", method_name="discharge")

    async def handle(self, session: WebSocketSession, request: DischargeSigil) -> None:
        await service.discharge(request, session.role, session.assigned_instance_id)


class ActivateSigilRoute(RequestRoute[ActivateSigil]):
    type_name = "activate_sigil"
    request_model = ActivateSigil
    emitted_event_models = (ActionExecutedEvent, StatePatchEvent)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(namespace="sigils", method_name="activate")

    async def handle(self, session: WebSocketSession, request: ActivateSigil) -> None:
        result = await service.activate(request, session.role, session.assigned_instance_id)
        await websocket_sessions.send(session, result)


class PreviewSigilRoute(RequestRoute[PreviewSigil]):
    type_name = "preview_sigil"
    request_model = PreviewSigil
    emitted_event_models = (SigilPreview,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(namespace="sigils", method_name="preview")

    async def handle(self, session: WebSocketSession, request: PreviewSigil) -> None:
        result = await service.preview(request, session.role, session.assigned_instance_id)
        await websocket_sessions.send(session, result)


def register_routes(registry: RequestRegistry) -> None:
    for route in (SetSigilAuthoringAccessRoute, SaveSigilRoute, DeleteSigilRoute, DuplicateSigilRoute, ImbueSigilRoute,
                  DischargeSigilRoute, ActivateSigilRoute, PreviewSigilRoute):
        registry.register(route())
