from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.session.models import WebSocketSession
from backend.features.sheet_admin.stats import service
from backend.features.sheet_admin.stats.schema import (
    SetSheetBaseStat,
    SetSheetFormulaStat,
)
from backend.protocol.socket import StatePatchEvent


class SetSheetBaseStatRoute(RequestRoute[SetSheetBaseStat]):
    type_name = "set_sheet_base_stat"
    request_model = SetSheetBaseStat
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminStats",
        method_name="setSheetBaseStat",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SetSheetBaseStat,
    ) -> None:
        await service.set_base_stat(request)


class SetSheetFormulaStatRoute(RequestRoute[SetSheetFormulaStat]):
    type_name = "set_sheet_formula_stat"
    request_model = SetSheetFormulaStat
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminStats",
        method_name="setSheetFormulaStat",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SetSheetFormulaStat,
    ) -> None:
        await service.set_formula_stat(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(SetSheetBaseStatRoute())
    registry.register(SetSheetFormulaStatRoute())
