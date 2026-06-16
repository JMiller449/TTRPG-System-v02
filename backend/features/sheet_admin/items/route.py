from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.session.models import WebSocketSession
from backend.features.sheet_admin.items import service
from backend.features.sheet_admin.items.schema import (
    RemoveItemAugmentationTemplate,
    UpsertItemAugmentationTemplate,
)
from backend.protocol.socket import StatePatchEvent


class UpsertItemAugmentationTemplateRoute(
    RequestRoute[UpsertItemAugmentationTemplate]
):
    type_name = "upsert_item_augmentation_template"
    request_model = UpsertItemAugmentationTemplate
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
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
    minimum_role = "dm"
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
    registry.register(UpsertItemAugmentationTemplateRoute())
    registry.register(RemoveItemAugmentationTemplateRoute())
