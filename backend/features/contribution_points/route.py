from backend.core.request_registry import ClientGenerationMetadata, RequestRegistry, RequestRoute
from backend.features.contribution_points import service
from backend.features.contribution_points.schema import (
    AdjustContributionPoints,
    SetContributionPoints,
)
from backend.features.session.models import WebSocketSession
from backend.protocol.socket import StatePatchEvent


class SetContributionPointsRoute(RequestRoute[SetContributionPoints]):
    type_name = "set_contribution_points"
    request_model = SetContributionPoints
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="contributionPoints", method_name="setBalance"
    )

    async def handle(self, session: WebSocketSession, request: SetContributionPoints) -> None:
        await service.set_contribution_points(request)


class AdjustContributionPointsRoute(RequestRoute[AdjustContributionPoints]):
    type_name = "adjust_contribution_points"
    request_model = AdjustContributionPoints
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="contributionPoints", method_name="adjustBalance"
    )

    async def handle(
        self, session: WebSocketSession, request: AdjustContributionPoints
    ) -> None:
        await service.adjust_contribution_points(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(SetContributionPointsRoute())
    registry.register(AdjustContributionPointsRoute())
