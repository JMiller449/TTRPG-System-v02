from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.session.models import WebSocketSession
from backend.features.sheet_access import handler
from backend.features.sheet_access.schema import (
    GenerateSheetAccessCode,
    GetSheetAccessCodes,
)
from backend.protocol.socket import SheetAccessCodesEvent


class GenerateSheetAccessCodeRoute(RequestRoute[GenerateSheetAccessCode]):
    type_name = "generate_sheet_access_code"
    request_model = GenerateSheetAccessCode
    emitted_event_models = (SheetAccessCodesEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetAccess",
        method_name="generateSheetAccessCode",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: GenerateSheetAccessCode,
    ) -> None:
        await handler.handle_generate_sheet_access_code(session, request)


class GetSheetAccessCodesRoute(RequestRoute[GetSheetAccessCodes]):
    type_name = "get_sheet_access_codes"
    request_model = GetSheetAccessCodes
    emitted_event_models = (SheetAccessCodesEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetAccess",
        method_name="getSheetAccessCodes",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: GetSheetAccessCodes,
    ) -> None:
        await handler.handle_get_sheet_access_codes(session, request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(GenerateSheetAccessCodeRoute())
    registry.register(GetSheetAccessCodesRoute())
