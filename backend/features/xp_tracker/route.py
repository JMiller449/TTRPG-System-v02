from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.session.models import WebSocketSession
from backend.features.xp_tracker import handler
from backend.features.xp_tracker.schema import (
    GetXpTracker,
    SetMobXpValue,
    SetSheetMobKillCount,
    SetSheetXpRequired,
)
from backend.protocol.socket import StatePatchEvent, XpTrackerEvent


class GetXpTrackerRoute(RequestRoute[GetXpTracker]):
    type_name = "get_xp_tracker"
    request_model = GetXpTracker
    emitted_event_models = (XpTrackerEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(
        namespace="xpTracker",
        method_name="getXpTracker",
    )

    async def handle(self, session: WebSocketSession, request: GetXpTracker) -> None:
        await handler.get_xp_tracker(session, request)


class SetSheetXpRequiredRoute(RequestRoute[SetSheetXpRequired]):
    type_name = "set_sheet_xp_required"
    request_model = SetSheetXpRequired
    emitted_event_models = (StatePatchEvent, XpTrackerEvent)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="xpTracker",
        method_name="setSheetXpRequired",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SetSheetXpRequired,
    ) -> None:
        await handler.set_sheet_xp_required(session, request)


class SetMobXpValueRoute(RequestRoute[SetMobXpValue]):
    type_name = "set_mob_xp_value"
    request_model = SetMobXpValue
    emitted_event_models = (StatePatchEvent, XpTrackerEvent)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="xpTracker",
        method_name="setMobXpValue",
    )

    async def handle(self, session: WebSocketSession, request: SetMobXpValue) -> None:
        await handler.set_mob_xp_value(session, request)


class SetSheetMobKillCountRoute(RequestRoute[SetSheetMobKillCount]):
    type_name = "set_sheet_mob_kill_count"
    request_model = SetSheetMobKillCount
    emitted_event_models = (StatePatchEvent, XpTrackerEvent)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(
        namespace="xpTracker",
        method_name="setSheetMobKillCount",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SetSheetMobKillCount,
    ) -> None:
        await handler.set_sheet_mob_kill_count(session, request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(GetXpTrackerRoute())
    registry.register(SetSheetXpRequiredRoute())
    registry.register(SetMobXpValueRoute())
    registry.register(SetSheetMobKillCountRoute())
