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
from backend.features.sheet_admin.sheets import service
from backend.features.sheet_admin.sheets.schema import (
    CreateSheetActionBridge,
    CreateSheetItemBridge,
    CreateSheetProficiencyBridge,
    CreateSheet,
    DeleteSheetActionBridge,
    DeleteSheetItemBridge,
    DeleteSheetProficiencyBridge,
    DeleteSheet,
    UpdateSheetActionBridge,
    UpdateSheetItemBridge,
    UpdateSheetProficiencyBridge,
    UpdateSheet,
)
from backend.protocol.socket import StatePatchEvent


class CreateSheetRoute(RequestRoute[CreateSheet]):
    type_name = "create_sheet"
    request_model = CreateSheet
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminSheets",
        method_name="createSheet",
    )

    async def handle(self, session: WebSocketSession, request: CreateSheet) -> None:
        await service.create_typed_sheet(request)


class UpdateSheetRoute(RequestRoute[UpdateSheet]):
    type_name = "update_sheet"
    request_model = UpdateSheet
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminSheets",
        method_name="updateSheet",
    )

    async def handle(self, session: WebSocketSession, request: UpdateSheet) -> None:
        await service.update_typed_sheet(request)


class DeleteSheetRoute(RequestRoute[DeleteSheet]):
    type_name = "delete_sheet"
    request_model = DeleteSheet
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminSheets",
        method_name="deleteSheet",
    )

    async def handle(self, session: WebSocketSession, request: DeleteSheet) -> None:
        await service.delete_typed_sheet(request)


class CreateSheetActionBridgeRoute(RequestRoute[CreateSheetActionBridge]):
    type_name = "create_sheet_action_bridge"
    request_model = CreateSheetActionBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetActionBridges",
        method_name="createSheetActionBridge",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: CreateSheetActionBridge,
    ) -> None:
        await service.create_sheet_action_bridge(request)


class UpdateSheetActionBridgeRoute(RequestRoute[UpdateSheetActionBridge]):
    type_name = "update_sheet_action_bridge"
    request_model = UpdateSheetActionBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetActionBridges",
        method_name="updateSheetActionBridge",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: UpdateSheetActionBridge,
    ) -> None:
        await service.update_sheet_action_bridge(request)


class DeleteSheetActionBridgeRoute(RequestRoute[DeleteSheetActionBridge]):
    type_name = "delete_sheet_action_bridge"
    request_model = DeleteSheetActionBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetActionBridges",
        method_name="deleteSheetActionBridge",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: DeleteSheetActionBridge,
    ) -> None:
        await service.delete_sheet_action_bridge(request)


class CreateSheetItemBridgeRoute(RequestRoute[CreateSheetItemBridge]):
    type_name = "create_sheet_item_bridge"
    request_model = CreateSheetItemBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("equipment_edit")
    permission_denied_reason = permission_denied_reason("equipment_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetItemBridges",
        method_name="createSheetItemBridge",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: CreateSheetItemBridge,
    ) -> None:
        await service.create_sheet_item_bridge(request)


class UpdateSheetItemBridgeRoute(RequestRoute[UpdateSheetItemBridge]):
    type_name = "update_sheet_item_bridge"
    request_model = UpdateSheetItemBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("equipment_edit")
    permission_denied_reason = permission_denied_reason("equipment_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetItemBridges",
        method_name="updateSheetItemBridge",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: UpdateSheetItemBridge,
    ) -> None:
        await service.update_sheet_item_bridge(request)


class DeleteSheetItemBridgeRoute(RequestRoute[DeleteSheetItemBridge]):
    type_name = "delete_sheet_item_bridge"
    request_model = DeleteSheetItemBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("equipment_edit")
    permission_denied_reason = permission_denied_reason("equipment_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetItemBridges",
        method_name="deleteSheetItemBridge",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: DeleteSheetItemBridge,
    ) -> None:
        await service.delete_sheet_item_bridge(request)


class CreateSheetProficiencyBridgeRoute(RequestRoute[CreateSheetProficiencyBridge]):
    type_name = "create_sheet_proficiency_bridge"
    request_model = CreateSheetProficiencyBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("proficiency_edit")
    permission_denied_reason = permission_denied_reason("proficiency_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetProficiencyBridges",
        method_name="createSheetProficiencyBridge",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: CreateSheetProficiencyBridge,
    ) -> None:
        await service.create_sheet_proficiency_bridge(request)


class UpdateSheetProficiencyBridgeRoute(RequestRoute[UpdateSheetProficiencyBridge]):
    type_name = "update_sheet_proficiency_bridge"
    request_model = UpdateSheetProficiencyBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("proficiency_edit")
    permission_denied_reason = permission_denied_reason("proficiency_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetProficiencyBridges",
        method_name="updateSheetProficiencyBridge",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: UpdateSheetProficiencyBridge,
    ) -> None:
        await service.update_sheet_proficiency_bridge(request)


class DeleteSheetProficiencyBridgeRoute(RequestRoute[DeleteSheetProficiencyBridge]):
    type_name = "delete_sheet_proficiency_bridge"
    request_model = DeleteSheetProficiencyBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("proficiency_edit")
    permission_denied_reason = permission_denied_reason("proficiency_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetProficiencyBridges",
        method_name="deleteSheetProficiencyBridge",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: DeleteSheetProficiencyBridge,
    ) -> None:
        await service.delete_sheet_proficiency_bridge(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(CreateSheetRoute())
    registry.register(UpdateSheetRoute())
    registry.register(DeleteSheetRoute())
    registry.register(CreateSheetActionBridgeRoute())
    registry.register(UpdateSheetActionBridgeRoute())
    registry.register(DeleteSheetActionBridgeRoute())
    registry.register(CreateSheetItemBridgeRoute())
    registry.register(UpdateSheetItemBridgeRoute())
    registry.register(DeleteSheetItemBridgeRoute())
    registry.register(CreateSheetProficiencyBridgeRoute())
    registry.register(UpdateSheetProficiencyBridgeRoute())
    registry.register(DeleteSheetProficiencyBridgeRoute())
