from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.session.models import WebSocketSession
from backend.features.sheet_admin.formulas import service
from backend.features.sheet_admin.formulas.schema import (
    CreateFormula,
    DeleteFormula,
    UpdateFormula,
)
from backend.protocol.socket import StatePatchEvent


class CreateFormulaRoute(RequestRoute[CreateFormula]):
    type_name = "create_formula"
    request_model = CreateFormula
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminFormulas",
        method_name="createFormula",
    )

    async def handle(self, session: WebSocketSession, request: CreateFormula) -> None:
        await service.create_typed_formula(request)


class UpdateFormulaRoute(RequestRoute[UpdateFormula]):
    type_name = "update_formula"
    request_model = UpdateFormula
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminFormulas",
        method_name="updateFormula",
    )

    async def handle(self, session: WebSocketSession, request: UpdateFormula) -> None:
        await service.update_typed_formula(request)


class DeleteFormulaRoute(RequestRoute[DeleteFormula]):
    type_name = "delete_formula"
    request_model = DeleteFormula
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminFormulas",
        method_name="deleteFormula",
    )

    async def handle(self, session: WebSocketSession, request: DeleteFormula) -> None:
        await service.delete_typed_formula(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(CreateFormulaRoute())
    registry.register(UpdateFormulaRoute())
    registry.register(DeleteFormulaRoute())
