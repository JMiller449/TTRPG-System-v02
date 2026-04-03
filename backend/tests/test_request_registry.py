from pydantic import BaseModel

from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
    request_registry,
)
from backend.protocol.socket import (
    ActionExecutedEvent,
    AuthenticateResponseEvent,
    StatePatchEvent,
    StateSnapshotEvent,
)


def test_request_registry_exposes_registered_request_models() -> None:
    model_names = {model.__name__ for model in request_registry.request_models()}

    assert {
        "Authenticate",
        "SendRoll20ChatMessage",
        "ResyncState",
        "PerformAction",
    }.issubset(model_names)


def test_request_registry_exposes_deduplicated_emitted_event_models() -> None:
    emitted_models = request_registry.emitted_event_models()

    assert StateSnapshotEvent in emitted_models
    assert StatePatchEvent in emitted_models
    assert ActionExecutedEvent in emitted_models
    assert AuthenticateResponseEvent in emitted_models
    assert emitted_models.count(StatePatchEvent) == 1


def test_request_registry_exposes_route_contracts_with_client_generation_metadata() -> None:
    contracts = {
        contract.type_name: contract for contract in request_registry.route_contracts()
    }

    assert contracts["send_roll20_chat_message"].client_generation == (
        ClientGenerationMetadata(
            namespace="chat",
            method_name="sendRoll20ChatMessage",
        )
    )
    assert contracts["authenticate"].client_generation == ClientGenerationMetadata(
        namespace="auth",
        method_name="authenticate",
    )
    assert contracts["authenticate"].minimum_role == "unauthenticated"
    assert contracts["resync_state"].client_generation == ClientGenerationMetadata(
        namespace="stateSync",
        method_name="resyncState",
    )
    assert contracts["perform_action"].client_generation == ClientGenerationMetadata(
        namespace="sheetRuntime",
        method_name="performAction",
    )
    assert contracts["perform_action"].minimum_role == "player"
    assert contracts["perform_action"].emitted_event_models == (
        ActionExecutedEvent,
        StatePatchEvent,
    )


def test_request_registry_rejects_duplicate_client_generation_metadata() -> None:
    class DuplicateRequest(BaseModel):
        type: str = "duplicate_request"

    class DuplicateRoute(RequestRoute[DuplicateRequest]):
        type_name = "duplicate_request"
        request_model = DuplicateRequest
        client_generation = ClientGenerationMetadata(
            namespace="chat",
            method_name="sendRoll20ChatMessage",
        )

        async def handle(self, session, request: DuplicateRequest) -> None:
            raise NotImplementedError

    registry = RequestRegistry()
    for route in request_registry.routes():
        registry.register(route)

    try:
        registry.register(DuplicateRoute())
    except ValueError as exc:
        assert str(exc) == (
            "Client generation metadata already registered for "
            "chat.sendRoll20ChatMessage."
        )
    else:
        raise AssertionError("Expected duplicate client-generation metadata to fail.")
