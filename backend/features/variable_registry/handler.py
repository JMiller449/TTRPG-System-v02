from backend.features.session.models import WebSocketSession
from backend.features.session.service import websocket_sessions
from backend.features.variable_registry import service
from backend.features.variable_registry.schema import (
    GetActionFormulaAuthoringMetadata,
    GetAugmentationTargetMetadata,
    GetVariableRegistry,
)


async def handle_request(
    session: WebSocketSession,
    request: GetVariableRegistry,
) -> None:
    await websocket_sessions.send(
        session,
        service.build_variable_registry(request_id=request.request_id),
    )


async def handle_authoring_metadata_request(
    session: WebSocketSession,
    request: GetActionFormulaAuthoringMetadata,
) -> None:
    await websocket_sessions.send(
        session,
        service.build_action_formula_authoring_metadata(
            request_id=request.request_id,
        ),
    )


async def handle_augmentation_target_metadata_request(
    session: WebSocketSession,
    request: GetAugmentationTargetMetadata,
) -> None:
    await websocket_sessions.send(
        session,
        service.build_augmentation_target_metadata(
            context=request.context,
            request_id=request.request_id,
        ),
    )
