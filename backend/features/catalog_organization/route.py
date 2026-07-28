from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.catalog_organization import service
from backend.features.catalog_organization.schema import (
    CreateCatalogFolder,
    DeleteCatalogFolder,
    MoveCatalogNode,
    RenameCatalogFolder,
)
from backend.features.session.models import WebSocketSession
from backend.protocol.socket import StatePatchEvent


class CreateCatalogFolderRoute(RequestRoute[CreateCatalogFolder]):
    type_name = "create_catalog_folder"
    request_model = CreateCatalogFolder
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="catalogOrganization",
        method_name="createFolder",
    )

    async def handle(
        self, session: WebSocketSession, request: CreateCatalogFolder
    ) -> None:
        await service.create_catalog_folder(request)


class RenameCatalogFolderRoute(RequestRoute[RenameCatalogFolder]):
    type_name = "rename_catalog_folder"
    request_model = RenameCatalogFolder
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="catalogOrganization",
        method_name="renameFolder",
    )

    async def handle(
        self, session: WebSocketSession, request: RenameCatalogFolder
    ) -> None:
        await service.rename_catalog_folder(request)


class MoveCatalogNodeRoute(RequestRoute[MoveCatalogNode]):
    type_name = "move_catalog_node"
    request_model = MoveCatalogNode
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="catalogOrganization",
        method_name="moveNode",
    )

    async def handle(self, session: WebSocketSession, request: MoveCatalogNode) -> None:
        await service.move_catalog_node(request)


class DeleteCatalogFolderRoute(RequestRoute[DeleteCatalogFolder]):
    type_name = "delete_catalog_folder"
    request_model = DeleteCatalogFolder
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="catalogOrganization",
        method_name="deleteFolder",
    )

    async def handle(
        self, session: WebSocketSession, request: DeleteCatalogFolder
    ) -> None:
        await service.delete_catalog_folder(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(CreateCatalogFolderRoute())
    registry.register(RenameCatalogFolderRoute())
    registry.register(MoveCatalogNodeRoute())
    registry.register(DeleteCatalogFolderRoute())
