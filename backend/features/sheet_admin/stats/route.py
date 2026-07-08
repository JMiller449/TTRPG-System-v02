from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.core.permissions import (
    permission_denied_reason,
    permission_minimum_role,
)
from backend.features.session.models import WebSocketSession
from backend.features.sheet_access import service as sheet_access_service
from backend.features.sheet_admin.stats import service
from backend.features.sheet_admin.stats.schema import (
    AllocateInstancedSheetStatPoints,
    SetInstancedSheetBaseStat,
    SetInstancedSheetFormulaStat,
    SetInstancedSheetResistances,
    SetInstancedSheetUnassignedStatPoints,
    SetSheetBaseStat,
    SetSheetFormulaStat,
    SetSheetResistances,
)
from backend.protocol.socket import StatePatchEvent


class SetSheetBaseStatRoute(RequestRoute[SetSheetBaseStat]):
    type_name = "set_sheet_base_stat"
    request_model = SetSheetBaseStat
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("stat_edit")
    permission_denied_reason = permission_denied_reason("stat_edit")
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


class SetInstancedSheetBaseStatRoute(RequestRoute[SetInstancedSheetBaseStat]):
    type_name = "set_instanced_sheet_base_stat"
    request_model = SetInstancedSheetBaseStat
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("stat_edit")
    permission_denied_reason = permission_denied_reason("stat_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetInstanceStats",
        method_name="setBaseStat",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SetInstancedSheetBaseStat,
    ) -> None:
        await service.set_instanced_base_stat(request)


class SetInstancedSheetUnassignedStatPointsRoute(
    RequestRoute[SetInstancedSheetUnassignedStatPoints]
):
    type_name = "set_instanced_sheet_unassigned_stat_points"
    request_model = SetInstancedSheetUnassignedStatPoints
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetInstanceStats",
        method_name="setUnassignedStatPoints",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SetInstancedSheetUnassignedStatPoints,
    ) -> None:
        await service.set_instanced_unassigned_stat_points(request)


class AllocateInstancedSheetStatPointsRoute(
    RequestRoute[AllocateInstancedSheetStatPoints]
):
    type_name = "allocate_instanced_sheet_stat_points"
    request_model = AllocateInstancedSheetStatPoints
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(
        namespace="sheetInstanceStats",
        method_name="allocateStatPoints",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: AllocateInstancedSheetStatPoints,
    ) -> None:
        sheet_access_service.ensure_session_can_access_instance(
            session,
            request.instance_id,
        )
        await service.allocate_instanced_stat_points(request)


class SetSheetFormulaStatRoute(RequestRoute[SetSheetFormulaStat]):
    type_name = "set_sheet_formula_stat"
    request_model = SetSheetFormulaStat
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("stat_edit")
    permission_denied_reason = permission_denied_reason("stat_edit")
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


class SetInstancedSheetFormulaStatRoute(RequestRoute[SetInstancedSheetFormulaStat]):
    type_name = "set_instanced_sheet_formula_stat"
    request_model = SetInstancedSheetFormulaStat
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("stat_edit")
    permission_denied_reason = permission_denied_reason("stat_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetInstanceStats",
        method_name="setFormulaStat",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SetInstancedSheetFormulaStat,
    ) -> None:
        await service.set_instanced_formula_stat(request)


class SetSheetResistancesRoute(RequestRoute[SetSheetResistances]):
    type_name = "set_sheet_resistances"
    request_model = SetSheetResistances
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("stat_edit")
    permission_denied_reason = permission_denied_reason("stat_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminStats",
        method_name="setSheetResistances",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SetSheetResistances,
    ) -> None:
        await service.set_resistances(request)


class SetInstancedSheetResistancesRoute(RequestRoute[SetInstancedSheetResistances]):
    type_name = "set_instanced_sheet_resistances"
    request_model = SetInstancedSheetResistances
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("stat_edit")
    permission_denied_reason = permission_denied_reason("stat_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetInstanceStats",
        method_name="setResistances",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SetInstancedSheetResistances,
    ) -> None:
        await service.set_instanced_resistances(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(SetSheetBaseStatRoute())
    registry.register(SetInstancedSheetBaseStatRoute())
    registry.register(SetInstancedSheetUnassignedStatPointsRoute())
    registry.register(AllocateInstancedSheetStatPointsRoute())
    registry.register(SetSheetFormulaStatRoute())
    registry.register(SetInstancedSheetFormulaStatRoute())
    registry.register(SetSheetResistancesRoute())
    registry.register(SetInstancedSheetResistancesRoute())
