from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.attributes import service
from backend.features.attributes.schema import (
    AttachSheetAttribute,
    AttachInstancedSheetAttribute,
    AttachSubjectAttribute,
    CreateAttribute,
    DeleteAttribute,
    DetachSheetAttribute,
    DetachInstancedSheetAttribute,
    DetachSubjectAttribute,
    ResetSubjectAttributeValue,
    ResetSheetAttributeValue,
    ResetInstancedSheetAttributeValue,
    SetSheetAttributeValue,
    SetInstancedSheetAttributeValue,
    SetSubjectAttributeValue,
    UpdateAttribute,
)
from backend.features.session.models import WebSocketSession
from backend.protocol.socket import StatePatchEvent


class CreateAttributeRoute(RequestRoute[CreateAttribute]):
    type_name = "create_attribute"
    request_model = CreateAttribute
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="attributes", method_name="createAttribute"
    )

    async def handle(self, session: WebSocketSession, request: CreateAttribute) -> None:
        await service.create_attribute(request)


class UpdateAttributeRoute(RequestRoute[UpdateAttribute]):
    type_name = "update_attribute"
    request_model = UpdateAttribute
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="attributes", method_name="updateAttribute"
    )

    async def handle(self, session: WebSocketSession, request: UpdateAttribute) -> None:
        await service.update_attribute(request)


class DeleteAttributeRoute(RequestRoute[DeleteAttribute]):
    type_name = "delete_attribute"
    request_model = DeleteAttribute
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="attributes", method_name="deleteAttribute"
    )

    async def handle(self, session: WebSocketSession, request: DeleteAttribute) -> None:
        await service.delete_attribute(request)


class AttachSheetAttributeRoute(RequestRoute[AttachSheetAttribute]):
    type_name = "attach_sheet_attribute"
    request_model = AttachSheetAttribute
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="attributes", method_name="attachSheetAttribute"
    )

    async def handle(self, session: WebSocketSession, request: AttachSheetAttribute) -> None:
        await service.attach_sheet_attribute(request)


class DetachSheetAttributeRoute(RequestRoute[DetachSheetAttribute]):
    type_name = "detach_sheet_attribute"
    request_model = DetachSheetAttribute
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="attributes", method_name="detachSheetAttribute"
    )

    async def handle(self, session: WebSocketSession, request: DetachSheetAttribute) -> None:
        await service.detach_sheet_attribute(request)


class AttachInstancedSheetAttributeRoute(RequestRoute[AttachInstancedSheetAttribute]):
    type_name = "attach_instanced_sheet_attribute"
    request_model = AttachInstancedSheetAttribute
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="attributes", method_name="attachInstancedSheetAttribute"
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: AttachInstancedSheetAttribute,
    ) -> None:
        await service.attach_instanced_sheet_attribute(request)


class DetachInstancedSheetAttributeRoute(RequestRoute[DetachInstancedSheetAttribute]):
    type_name = "detach_instanced_sheet_attribute"
    request_model = DetachInstancedSheetAttribute
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="attributes", method_name="detachInstancedSheetAttribute"
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: DetachInstancedSheetAttribute,
    ) -> None:
        await service.detach_instanced_sheet_attribute(request)


class AttachSubjectAttributeRoute(RequestRoute[AttachSubjectAttribute]):
    type_name = "attach_subject_attribute"
    request_model = AttachSubjectAttribute
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="attributes", method_name="attachSubjectAttribute"
    )

    async def handle(self, session: WebSocketSession, request: AttachSubjectAttribute) -> None:
        await service.attach_subject_attribute(request)


class SetSubjectAttributeValueRoute(RequestRoute[SetSubjectAttributeValue]):
    type_name = "set_subject_attribute_value"
    request_model = SetSubjectAttributeValue
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="attributes", method_name="setSubjectAttributeValue"
    )

    async def handle(self, session: WebSocketSession, request: SetSubjectAttributeValue) -> None:
        await service.set_subject_attribute_value(request)


class ResetSubjectAttributeValueRoute(RequestRoute[ResetSubjectAttributeValue]):
    type_name = "reset_subject_attribute_value"
    request_model = ResetSubjectAttributeValue
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="attributes", method_name="resetSubjectAttributeValue"
    )

    async def handle(self, session: WebSocketSession, request: ResetSubjectAttributeValue) -> None:
        await service.reset_subject_attribute_value(request)


class DetachSubjectAttributeRoute(RequestRoute[DetachSubjectAttribute]):
    type_name = "detach_subject_attribute"
    request_model = DetachSubjectAttribute
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="attributes", method_name="detachSubjectAttribute"
    )

    async def handle(self, session: WebSocketSession, request: DetachSubjectAttribute) -> None:
        await service.detach_subject_attribute(request)


class SetSheetAttributeValueRoute(RequestRoute[SetSheetAttributeValue]):
    type_name = "set_sheet_attribute_value"
    request_model = SetSheetAttributeValue
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="attributes",
        method_name="setSheetAttributeValue",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SetSheetAttributeValue,
    ) -> None:
        await service.set_sheet_attribute_value(request)


class ResetSheetAttributeValueRoute(RequestRoute[ResetSheetAttributeValue]):
    type_name = "reset_sheet_attribute_value"
    request_model = ResetSheetAttributeValue
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="attributes",
        method_name="resetSheetAttributeValue",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: ResetSheetAttributeValue,
    ) -> None:
        await service.reset_sheet_attribute_value(request)


class SetInstancedSheetAttributeValueRoute(RequestRoute[SetInstancedSheetAttributeValue]):
    type_name = "set_instanced_sheet_attribute_value"
    request_model = SetInstancedSheetAttributeValue
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="attributes",
        method_name="setInstancedSheetAttributeValue",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SetInstancedSheetAttributeValue,
    ) -> None:
        await service.set_instanced_sheet_attribute_value(request)


class ResetInstancedSheetAttributeValueRoute(RequestRoute[ResetInstancedSheetAttributeValue]):
    type_name = "reset_instanced_sheet_attribute_value"
    request_model = ResetInstancedSheetAttributeValue
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="attributes",
        method_name="resetInstancedSheetAttributeValue",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: ResetInstancedSheetAttributeValue,
    ) -> None:
        await service.reset_instanced_sheet_attribute_value(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(CreateAttributeRoute())
    registry.register(UpdateAttributeRoute())
    registry.register(DeleteAttributeRoute())
    registry.register(AttachSheetAttributeRoute())
    registry.register(DetachSheetAttributeRoute())
    registry.register(AttachInstancedSheetAttributeRoute())
    registry.register(DetachInstancedSheetAttributeRoute())
    registry.register(AttachSubjectAttributeRoute())
    registry.register(SetSubjectAttributeValueRoute())
    registry.register(ResetSubjectAttributeValueRoute())
    registry.register(DetachSubjectAttributeRoute())
    registry.register(SetSheetAttributeValueRoute())
    registry.register(ResetSheetAttributeValueRoute())
    registry.register(SetInstancedSheetAttributeValueRoute())
    registry.register(ResetInstancedSheetAttributeValueRoute())
