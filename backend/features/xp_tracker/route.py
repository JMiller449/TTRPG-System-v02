from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.session.models import WebSocketSession
from backend.features.xp_tracker import handler
from backend.features.xp_tracker.schema import (
    DeleteKill,
    DeleteParty,
    DeleteXpAdjustment,
    GetXpTracker,
    RecordKill,
    SaveParty,
    SaveXpAdjustment,
    SetMobXpValue,
    SetSheetXpRequired,
    UpdateKill,
)
from backend.protocol.socket import StatePatchEvent, XpTrackerEvent


class GetXpTrackerRoute(RequestRoute[GetXpTracker]):
    type_name = "get_xp_tracker"
    request_model = GetXpTracker
    emitted_event_models = (XpTrackerEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(
        namespace="xpTracker", method_name="getXpTracker"
    )

    async def handle(self, session: WebSocketSession, request: GetXpTracker) -> None:
        await handler.get_xp_tracker(session, request)


class _DmMutationRoute:
    emitted_event_models = (StatePatchEvent, XpTrackerEvent)
    minimum_role = "dm"


class SetSheetXpRequiredRoute(_DmMutationRoute, RequestRoute[SetSheetXpRequired]):
    type_name = "set_sheet_xp_required"
    request_model = SetSheetXpRequired
    client_generation = ClientGenerationMetadata(
        namespace="xpTracker", method_name="setSheetXpRequired"
    )

    async def handle(self, session: WebSocketSession, request: SetSheetXpRequired) -> None:
        await handler.set_sheet_xp_required(session, request)


class SetMobXpValueRoute(_DmMutationRoute, RequestRoute[SetMobXpValue]):
    type_name = "set_mob_xp_value"
    request_model = SetMobXpValue
    client_generation = ClientGenerationMetadata(
        namespace="xpTracker", method_name="setMobXpValue"
    )

    async def handle(self, session: WebSocketSession, request: SetMobXpValue) -> None:
        await handler.set_mob_xp_value(session, request)


class SavePartyRoute(_DmMutationRoute, RequestRoute[SaveParty]):
    type_name = "save_party"
    request_model = SaveParty
    client_generation = ClientGenerationMetadata(
        namespace="xpTracker", method_name="saveParty"
    )

    async def handle(self, session: WebSocketSession, request: SaveParty) -> None:
        await handler.save_party(session, request)


class DeletePartyRoute(_DmMutationRoute, RequestRoute[DeleteParty]):
    type_name = "delete_party"
    request_model = DeleteParty
    client_generation = ClientGenerationMetadata(
        namespace="xpTracker", method_name="deleteParty"
    )

    async def handle(self, session: WebSocketSession, request: DeleteParty) -> None:
        await handler.delete_party(session, request)


class RecordKillRoute(_DmMutationRoute, RequestRoute[RecordKill]):
    type_name = "record_kill"
    request_model = RecordKill
    client_generation = ClientGenerationMetadata(
        namespace="xpTracker", method_name="recordKill"
    )

    async def handle(self, session: WebSocketSession, request: RecordKill) -> None:
        await handler.record_kill(session, request)


class UpdateKillRoute(_DmMutationRoute, RequestRoute[UpdateKill]):
    type_name = "update_kill"
    request_model = UpdateKill
    client_generation = ClientGenerationMetadata(
        namespace="xpTracker", method_name="updateKill"
    )

    async def handle(self, session: WebSocketSession, request: UpdateKill) -> None:
        await handler.update_kill(session, request)


class DeleteKillRoute(_DmMutationRoute, RequestRoute[DeleteKill]):
    type_name = "delete_kill"
    request_model = DeleteKill
    client_generation = ClientGenerationMetadata(
        namespace="xpTracker", method_name="deleteKill"
    )

    async def handle(self, session: WebSocketSession, request: DeleteKill) -> None:
        await handler.delete_kill(session, request)


class SaveXpAdjustmentRoute(_DmMutationRoute, RequestRoute[SaveXpAdjustment]):
    type_name = "save_xp_adjustment"
    request_model = SaveXpAdjustment
    client_generation = ClientGenerationMetadata(
        namespace="xpTracker", method_name="saveXpAdjustment"
    )

    async def handle(self, session: WebSocketSession, request: SaveXpAdjustment) -> None:
        await handler.save_xp_adjustment(session, request)


class DeleteXpAdjustmentRoute(
    _DmMutationRoute, RequestRoute[DeleteXpAdjustment]
):
    type_name = "delete_xp_adjustment"
    request_model = DeleteXpAdjustment
    client_generation = ClientGenerationMetadata(
        namespace="xpTracker", method_name="deleteXpAdjustment"
    )

    async def handle(
        self, session: WebSocketSession, request: DeleteXpAdjustment
    ) -> None:
        await handler.delete_xp_adjustment(session, request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(GetXpTrackerRoute())
    registry.register(SetSheetXpRequiredRoute())
    registry.register(SetMobXpValueRoute())
    registry.register(SavePartyRoute())
    registry.register(DeletePartyRoute())
    registry.register(RecordKillRoute())
    registry.register(UpdateKillRoute())
    registry.register(DeleteKillRoute())
    registry.register(SaveXpAdjustmentRoute())
    registry.register(DeleteXpAdjustmentRoute())
