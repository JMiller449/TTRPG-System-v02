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
from backend.features.sheet_admin.items import service
from backend.features.sheet_admin.items.schema import (
    CreateItem,
    DeleteItem,
    RemoveItemAugmentationTemplate,
    UpdateItem,
    UpsertItemAugmentationTemplate,
)
from backend.protocol.socket import StatePatchEvent


class CreateItemRoute(RequestRoute[CreateItem]):
    type_name = "create_item"
    request_model = CreateItem
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("equipment_edit")
    permission_denied_reason = permission_denied_reason("equipment_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminItems",
        method_name="createItem",
    )

    async def handle(self, session: WebSocketSession, request: CreateItem) -> None:
        await service.create_typed_item(request)


class UpdateItemRoute(RequestRoute[UpdateItem]):
    type_name = "update_item"
    request_model = UpdateItem
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("equipment_edit")
    permission_denied_reason = permission_denied_reason("equipment_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminItems",
        method_name="updateItem",
    )

    async def handle(self, session: WebSocketSession, request: UpdateItem) -> None:
        await service.update_typed_item(request)


class DeleteItemRoute(RequestRoute[DeleteItem]):
    type_name = "delete_item"
    request_model = DeleteItem
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("equipment_edit")
    permission_denied_reason = permission_denied_reason("equipment_edit")
    client_generation = ClientGenerationMetadata(
        namespace="sheetAdminItems",
        method_name="deleteItem",
    )

    async def handle(self, session: WebSocketSession, request: DeleteItem) -> None:
        await service.delete_typed_item(request)


class UpsertItemAugmentationTemplateRoute(
    RequestRoute[UpsertItemAugmentationTemplate]
):
    type_name = "upsert_item_augmentation_template"
    request_model = UpsertItemAugmentationTemplate
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("equipment_edit")
    permission_denied_reason = permission_denied_reason("equipment_edit")
    client_generation = ClientGenerationMetadata(
        namespace="itemAugmentations",
        method_name="upsertItemAugmentationTemplate",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: UpsertItemAugmentationTemplate,
    ) -> None:
        await service.upsert_item_augmentation_template(request)


class RemoveItemAugmentationTemplateRoute(
    RequestRoute[RemoveItemAugmentationTemplate]
):
    type_name = "remove_item_augmentation_template"
    request_model = RemoveItemAugmentationTemplate
    emitted_event_models = (StatePatchEvent,)
    minimum_role = permission_minimum_role("equipment_edit")
    permission_denied_reason = permission_denied_reason("equipment_edit")
    client_generation = ClientGenerationMetadata(
        namespace="itemAugmentations",
        method_name="removeItemAugmentationTemplate",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: RemoveItemAugmentationTemplate,
    ) -> None:
        await service.remove_item_augmentation_template(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(CreateItemRoute())
    registry.register(UpdateItemRoute())
    registry.register(DeleteItemRoute())
    registry.register(UpsertItemAugmentationTemplateRoute())
    registry.register(RemoveItemAugmentationTemplateRoute())
