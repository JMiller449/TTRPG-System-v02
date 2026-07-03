from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.facts import service
from backend.features.facts.schema import (
    AttachSheetFact,
    AttachSubjectFact,
    CreateFact,
    DeleteFact,
    DetachSheetFact,
    DetachSubjectFact,
    ResetSubjectFactValue,
    ResetSheetFactValue,
    SetSheetFactValue,
    SetSubjectFactValue,
    UpdateFact,
)
from backend.features.session.models import WebSocketSession
from backend.protocol.socket import StatePatchEvent


class CreateFactRoute(RequestRoute[CreateFact]):
    type_name = "create_fact"
    request_model = CreateFact
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="facts", method_name="createFact"
    )

    async def handle(self, session: WebSocketSession, request: CreateFact) -> None:
        await service.create_fact(request)


class UpdateFactRoute(RequestRoute[UpdateFact]):
    type_name = "update_fact"
    request_model = UpdateFact
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="facts", method_name="updateFact"
    )

    async def handle(self, session: WebSocketSession, request: UpdateFact) -> None:
        await service.update_fact(request)


class DeleteFactRoute(RequestRoute[DeleteFact]):
    type_name = "delete_fact"
    request_model = DeleteFact
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="facts", method_name="deleteFact"
    )

    async def handle(self, session: WebSocketSession, request: DeleteFact) -> None:
        await service.delete_fact(request)


class AttachSheetFactRoute(RequestRoute[AttachSheetFact]):
    type_name = "attach_sheet_fact"
    request_model = AttachSheetFact
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="facts", method_name="attachSheetFact"
    )

    async def handle(self, session: WebSocketSession, request: AttachSheetFact) -> None:
        await service.attach_sheet_fact(request)


class DetachSheetFactRoute(RequestRoute[DetachSheetFact]):
    type_name = "detach_sheet_fact"
    request_model = DetachSheetFact
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="facts", method_name="detachSheetFact"
    )

    async def handle(self, session: WebSocketSession, request: DetachSheetFact) -> None:
        await service.detach_sheet_fact(request)


class AttachSubjectFactRoute(RequestRoute[AttachSubjectFact]):
    type_name = "attach_subject_fact"
    request_model = AttachSubjectFact
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="facts", method_name="attachSubjectFact"
    )

    async def handle(self, session: WebSocketSession, request: AttachSubjectFact) -> None:
        await service.attach_subject_fact(request)


class SetSubjectFactValueRoute(RequestRoute[SetSubjectFactValue]):
    type_name = "set_subject_fact_value"
    request_model = SetSubjectFactValue
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="facts", method_name="setSubjectFactValue"
    )

    async def handle(self, session: WebSocketSession, request: SetSubjectFactValue) -> None:
        await service.set_subject_fact_value(request)


class ResetSubjectFactValueRoute(RequestRoute[ResetSubjectFactValue]):
    type_name = "reset_subject_fact_value"
    request_model = ResetSubjectFactValue
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="facts", method_name="resetSubjectFactValue"
    )

    async def handle(self, session: WebSocketSession, request: ResetSubjectFactValue) -> None:
        await service.reset_subject_fact_value(request)


class DetachSubjectFactRoute(RequestRoute[DetachSubjectFact]):
    type_name = "detach_subject_fact"
    request_model = DetachSubjectFact
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="facts", method_name="detachSubjectFact"
    )

    async def handle(self, session: WebSocketSession, request: DetachSubjectFact) -> None:
        await service.detach_subject_fact(request)


class SetSheetFactValueRoute(RequestRoute[SetSheetFactValue]):
    type_name = "set_sheet_fact_value"
    request_model = SetSheetFactValue
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="facts",
        method_name="setSheetFactValue",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SetSheetFactValue,
    ) -> None:
        await service.set_sheet_fact_value(request)


class ResetSheetFactValueRoute(RequestRoute[ResetSheetFactValue]):
    type_name = "reset_sheet_fact_value"
    request_model = ResetSheetFactValue
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="facts",
        method_name="resetSheetFactValue",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: ResetSheetFactValue,
    ) -> None:
        await service.reset_sheet_fact_value(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(CreateFactRoute())
    registry.register(UpdateFactRoute())
    registry.register(DeleteFactRoute())
    registry.register(AttachSheetFactRoute())
    registry.register(DetachSheetFactRoute())
    registry.register(AttachSubjectFactRoute())
    registry.register(SetSubjectFactValueRoute())
    registry.register(ResetSubjectFactValueRoute())
    registry.register(DetachSubjectFactRoute())
    registry.register(SetSheetFactValueRoute())
    registry.register(ResetSheetFactValueRoute())
