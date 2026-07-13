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
    AddPlayerInventoryItem,
    CreateItem,
    DeleteItem,
    RemovePlayerInventoryItem,
    RemoveItemAugmentationTemplate,
    ReviewPlayerItem,
    SubmitPlayerItem,
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


class AddPlayerInventoryItemRoute(RequestRoute[AddPlayerInventoryItem]):
    type_name = "add_player_inventory_item"
    request_model = AddPlayerInventoryItem
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(
        namespace="playerInventory",
        method_name="addItem",
    )

    async def handle(
        self, session: WebSocketSession, request: AddPlayerInventoryItem
    ) -> None:
        await service.add_player_inventory_item(session, request)


class RemovePlayerInventoryItemRoute(RequestRoute[RemovePlayerInventoryItem]):
    type_name = "remove_player_inventory_item"
    request_model = RemovePlayerInventoryItem
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(
        namespace="playerInventory",
        method_name="removeItem",
    )

    async def handle(
        self, session: WebSocketSession, request: RemovePlayerInventoryItem
    ) -> None:
        await service.remove_player_inventory_item(session, request)


class SubmitPlayerItemRoute(RequestRoute[SubmitPlayerItem]):
    type_name = "submit_player_item"
    request_model = SubmitPlayerItem
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "player"
    client_generation = ClientGenerationMetadata(
        namespace="playerItems",
        method_name="submitItem",
    )

    async def handle(
        self, session: WebSocketSession, request: SubmitPlayerItem
    ) -> None:
        await service.submit_player_item(session, request)


class ReviewPlayerItemRoute(RequestRoute[ReviewPlayerItem]):
    type_name = "review_player_item"
    request_model = ReviewPlayerItem
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="playerItems",
        method_name="reviewItem",
    )

    async def handle(
        self, session: WebSocketSession, request: ReviewPlayerItem
    ) -> None:
        await service.review_player_item(request)


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
    registry.register(AddPlayerInventoryItemRoute())
    registry.register(RemovePlayerInventoryItemRoute())
    registry.register(SubmitPlayerItemRoute())
    registry.register(ReviewPlayerItemRoute())
    registry.register(UpsertItemAugmentationTemplateRoute())
    registry.register(RemoveItemAugmentationTemplateRoute())
