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
from backend.features.sheet_admin.sheets import service
from backend.features.sheet_admin.sheets.schema import (
    AdjustInstancedSheetResource,
    CreateInstancedSheet,
    CreateSheetActionBridge,
    CreateSheetItemBridge,
    CreateSheetProficiencyBridge,
    CreateSheet,
    DeleteSheetActionBridge,
    DeleteSheetItemBridge,
    DeleteSheetProficiencyBridge,
    DeleteSheet,
    SetInstancedSheetNotes,
    SetInstancedSheetResource,
    SetSheetNotes,
    UpdateSheetActionBridge,
    UpdateSheetItemBridge,
    UpdateSheetProficiencyBridge,
    UpdateSheet,
)
from backend.features.session.service import websocket_sessions
from backend.protocol.socket import SheetAccessCodesEvent, StatePatchEvent


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


class SetSheetNotesRoute(RequestRoute[SetSheetNotes]):
    type_name = "set_sheet_notes"
    request_model = SetSheetNotes
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("notes_edit")
    permission_denied_reason = permission_denied_reason("notes_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminNotes",
        method_name="setSheetNotes",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SetSheetNotes,
    ) -> None:
        await service.set_sheet_notes(request)


class SetInstancedSheetNotesRoute(RequestRoute[SetInstancedSheetNotes]):
    type_name = "set_instanced_sheet_notes"
    request_model = SetInstancedSheetNotes
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("instance_notes_edit")
    permission_denied_reason = permission_denied_reason("instance_notes_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetInstanceNotes",
        method_name="setInstancedSheetNotes",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SetInstancedSheetNotes,
    ) -> None:
        sheet_access_service.ensure_session_can_access_instance(
            session,
            request.instance_id,
        )
        await service.set_instanced_sheet_notes(request)


class SetInstancedSheetResourceRoute(RequestRoute[SetInstancedSheetResource]):
    type_name = "set_instanced_sheet_resource"
    request_model = SetInstancedSheetResource
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("resource_edit")
    permission_denied_reason = permission_denied_reason("resource_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetInstanceResources",
        method_name="setInstancedSheetResource",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SetInstancedSheetResource,
    ) -> None:
        sheet_access_service.ensure_session_can_access_instance(
            session,
            request.instance_id,
        )
        await service.set_instanced_sheet_resource(request)


class AdjustInstancedSheetResourceRoute(RequestRoute[AdjustInstancedSheetResource]):
    type_name = "adjust_instanced_sheet_resource"
    request_model = AdjustInstancedSheetResource
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("resource_edit")
    permission_denied_reason = permission_denied_reason("resource_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetInstanceResources",
        method_name="adjustInstancedSheetResource",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: AdjustInstancedSheetResource,
    ) -> None:
        sheet_access_service.ensure_session_can_access_instance(
            session,
            request.instance_id,
        )
        await service.adjust_instanced_sheet_resource(request)


class CreateInstancedSheetRoute(RequestRoute[CreateInstancedSheet]):
    type_name = "create_instanced_sheet"
    request_model = CreateInstancedSheet
    emitted_event_models = (StatePatchEvent, SheetAccessCodesEvent)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminSheets",
        method_name="instantiateSheet",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: CreateInstancedSheet,
    ) -> None:
        response = await service.instantiate_sheet(request)
        if response is not None:
            await websocket_sessions.send(session, response)


class CreateSheetActionBridgeRoute(RequestRoute[CreateSheetActionBridge]):
    type_name = "create_sheet_action_bridge"
    request_model = CreateSheetActionBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetActionBridges",
        method_name="attachAction",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: CreateSheetActionBridge,
    ) -> None:
        await service.attach_sheet_action(request)


class UpdateSheetActionBridgeRoute(RequestRoute[UpdateSheetActionBridge]):
    type_name = "update_sheet_action_bridge"
    request_model = UpdateSheetActionBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetActionBridges",
        method_name="relinkAction",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: UpdateSheetActionBridge,
    ) -> None:
        await service.relink_sheet_action(request)


class DeleteSheetActionBridgeRoute(RequestRoute[DeleteSheetActionBridge]):
    type_name = "delete_sheet_action_bridge"
    request_model = DeleteSheetActionBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="sheetActionBridges",
        method_name="detachAction",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: DeleteSheetActionBridge,
    ) -> None:
        await service.detach_sheet_action(request)


class CreateSheetItemBridgeRoute(RequestRoute[CreateSheetItemBridge]):
    type_name = "create_sheet_item_bridge"
    request_model = CreateSheetItemBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("equipment_edit")
    permission_denied_reason = permission_denied_reason("equipment_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetItemBridges",
        method_name="attachItem",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: CreateSheetItemBridge,
    ) -> None:
        await service.attach_sheet_item(request)


class UpdateSheetItemBridgeRoute(RequestRoute[UpdateSheetItemBridge]):
    type_name = "update_sheet_item_bridge"
    request_model = UpdateSheetItemBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("equipment_edit")
    permission_denied_reason = permission_denied_reason("equipment_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetItemBridges",
        method_name="updateAttachedItem",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: UpdateSheetItemBridge,
    ) -> None:
        await service.update_attached_sheet_item(request)


class DeleteSheetItemBridgeRoute(RequestRoute[DeleteSheetItemBridge]):
    type_name = "delete_sheet_item_bridge"
    request_model = DeleteSheetItemBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("equipment_edit")
    permission_denied_reason = permission_denied_reason("equipment_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetItemBridges",
        method_name="detachItem",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: DeleteSheetItemBridge,
    ) -> None:
        await service.detach_sheet_item(request)


class CreateSheetProficiencyBridgeRoute(RequestRoute[CreateSheetProficiencyBridge]):
    type_name = "create_sheet_proficiency_bridge"
    request_model = CreateSheetProficiencyBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("proficiency_edit")
    permission_denied_reason = permission_denied_reason("proficiency_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetProficiencyBridges",
        method_name="linkProficiency",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: CreateSheetProficiencyBridge,
    ) -> None:
        await service.link_sheet_proficiency(request)


class UpdateSheetProficiencyBridgeRoute(RequestRoute[UpdateSheetProficiencyBridge]):
    type_name = "update_sheet_proficiency_bridge"
    request_model = UpdateSheetProficiencyBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("proficiency_edit")
    permission_denied_reason = permission_denied_reason("proficiency_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetProficiencyBridges",
        method_name="updateLinkedProficiency",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: UpdateSheetProficiencyBridge,
    ) -> None:
        await service.update_linked_sheet_proficiency(request)


class DeleteSheetProficiencyBridgeRoute(RequestRoute[DeleteSheetProficiencyBridge]):
    type_name = "delete_sheet_proficiency_bridge"
    request_model = DeleteSheetProficiencyBridge
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("proficiency_edit")
    permission_denied_reason = permission_denied_reason("proficiency_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetProficiencyBridges",
        method_name="unlinkProficiency",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: DeleteSheetProficiencyBridge,
    ) -> None:
        await service.unlink_sheet_proficiency(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(CreateSheetRoute())
    registry.register(UpdateSheetRoute())
    registry.register(DeleteSheetRoute())
    registry.register(SetSheetNotesRoute())
    registry.register(SetInstancedSheetNotesRoute())
    registry.register(SetInstancedSheetResourceRoute())
    registry.register(AdjustInstancedSheetResourceRoute())
    registry.register(CreateInstancedSheetRoute())
    registry.register(CreateSheetActionBridgeRoute())
    registry.register(UpdateSheetActionBridgeRoute())
    registry.register(DeleteSheetActionBridgeRoute())
    registry.register(CreateSheetItemBridgeRoute())
    registry.register(UpdateSheetItemBridgeRoute())
    registry.register(DeleteSheetItemBridgeRoute())
    registry.register(CreateSheetProficiencyBridgeRoute())
    registry.register(UpdateSheetProficiencyBridgeRoute())
    registry.register(DeleteSheetProficiencyBridgeRoute())
