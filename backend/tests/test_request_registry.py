from backend.core.request_registry import request_registry
from backend.protocol.socket import ActionExecutedEvent, StatePatchEvent, StateSnapshotEvent


def test_request_registry_exposes_registered_request_models() -> None:
    model_names = {model.__name__ for model in request_registry.request_models()}

    assert {
        "SendRoll20ChatMessage",
        "ResyncState",
        "PerformAction",
        "CreateEntity",
        "UpdateEntity",
        "DeleteEntity",
    }.issubset(model_names)


def test_request_registry_exposes_deduplicated_emitted_event_models() -> None:
    emitted_models = request_registry.emitted_event_models()

    assert StateSnapshotEvent in emitted_models
    assert StatePatchEvent in emitted_models
    assert ActionExecutedEvent in emitted_models
    assert emitted_models.count(StatePatchEvent) == 1
