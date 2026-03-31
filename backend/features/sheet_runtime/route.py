from backend.core.request_registry import RequestRegistry, RequestRoute
from backend.features.session.models import WebSocketSession
from backend.features.sheet_runtime import handler
from backend.features.sheet_runtime.schema import FocusSheet, PerformAction, RollBasicCheck


class FocusSheetRoute(RequestRoute[FocusSheet]):
    type_name = "focus_sheet"
    request_model = FocusSheet

    async def handle(self, session: WebSocketSession, request: FocusSheet) -> None:
        await handler.handle_focus_sheet_request(session, request)


class RollBasicCheckRoute(RequestRoute[RollBasicCheck]):
    type_name = "roll_basic_check"
    request_model = RollBasicCheck

    async def handle(self, session: WebSocketSession, request: RollBasicCheck) -> None:
        await handler.handle_roll_basic_check_request(session, request)


class PerformActionRoute(RequestRoute[PerformAction]):
    type_name = "perform_action"
    request_model = PerformAction

    async def handle(self, session: WebSocketSession, request: PerformAction) -> None:
        await handler.handle_request(session, request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(FocusSheetRoute())
    registry.register(RollBasicCheckRoute())
    registry.register(PerformActionRoute())
