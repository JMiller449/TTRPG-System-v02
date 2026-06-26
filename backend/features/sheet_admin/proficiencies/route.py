from backend.core.permissions import (
    permission_denied_reason,
    permission_minimum_role,
)
from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.session.models import WebSocketSession
from backend.features.sheet_admin.proficiencies import service
from backend.features.sheet_admin.proficiencies.schema import (
    CreateProficiency,
    DeleteProficiency,
    UpdateProficiency,
)
from backend.protocol.socket import StatePatchEvent


class CreateProficiencyRoute(RequestRoute[CreateProficiency]):
    type_name = "create_proficiency"
    request_model = CreateProficiency
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("proficiency_edit")
    permission_denied_reason = permission_denied_reason("proficiency_edit")
    client_generation = ClientGenerationMetadata(
        namespace="proficiencies",
        method_name="createProficiency",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: CreateProficiency,
    ) -> None:
        await service.create_proficiency(request)


class UpdateProficiencyRoute(RequestRoute[UpdateProficiency]):
    type_name = "update_proficiency"
    request_model = UpdateProficiency
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("proficiency_edit")
    permission_denied_reason = permission_denied_reason("proficiency_edit")
    client_generation = ClientGenerationMetadata(
        namespace="proficiencies",
        method_name="updateProficiency",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: UpdateProficiency,
    ) -> None:
        await service.update_proficiency(request)


class DeleteProficiencyRoute(RequestRoute[DeleteProficiency]):
    type_name = "delete_proficiency"
    request_model = DeleteProficiency
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("proficiency_edit")
    permission_denied_reason = permission_denied_reason("proficiency_edit")
    client_generation = ClientGenerationMetadata(
        namespace="proficiencies",
        method_name="deleteProficiency",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: DeleteProficiency,
    ) -> None:
        await service.delete_proficiency(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(CreateProficiencyRoute())
    registry.register(UpdateProficiencyRoute())
    registry.register(DeleteProficiencyRoute())
