from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from backend.features.auth.schema import Authenticate, AuthRole
from backend.features.chat.schema import SendRoll20ChatMessage
from backend.features.sheet_runtime.schema import PerformAction
from backend.features.state_sync.schema import ResyncState
from backend.protocol.state_schema import BackendStateSnapshotPayload


class ProtocolModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PatchOperation(ProtocolModel):
    op: Literal["set", "inc", "add", "remove"]
    path: str
    value: Any | None = None


class ErrorEvent(ProtocolModel):
    response_id: str | None = None
    reason: str
    type: Literal["error"] = "error"
    request_id: str | None = None


class AuthenticateResponseEvent(ProtocolModel):
    response_id: str | None = None
    authenticated: bool
    role: AuthRole | None
    reason: str | None = None
    type: Literal["authenticate_response"] = "authenticate_response"
    request_id: str | None = None


class StateSnapshotEvent(ProtocolModel):
    response_id: str | None = None
    state: BackendStateSnapshotPayload
    state_version: int
    type: Literal["state_snapshot"] = "state_snapshot"
    request_id: str | None = None


class StatePatchEvent(ProtocolModel):
    response_id: str | None = None
    ops: list[PatchOperation] | None = None
    state_version: int = 0
    type: Literal["state_patch"] = "state_patch"
    request_id: str | None = None


class ActionExecutedEvent(ProtocolModel):
    response_id: str | None = None
    sheet_id: str
    action_id: str
    applied_mutations: list[str]
    emitted_messages: list[str]
    type: Literal["action_executed"] = "action_executed"
    request_id: str | None = None


ApplicationRequest = Annotated[
    Authenticate
    | ResyncState
    | SendRoll20ChatMessage
    | PerformAction,
    Field(discriminator="type"),
]

ServerEvent = Annotated[
    ErrorEvent
    | AuthenticateResponseEvent
    | StateSnapshotEvent
    | StatePatchEvent
    | ActionExecutedEvent,
    Field(discriminator="type"),
]

_APPLICATION_REQUEST_ADAPTER = TypeAdapter(ApplicationRequest)
_SERVER_EVENT_ADAPTER = TypeAdapter(ServerEvent)


def parse_application_request(payload: Any) -> BaseModel:
    return _APPLICATION_REQUEST_ADAPTER.validate_python(payload)


def normalize_server_event(payload: Any) -> dict[str, Any]:
    if isinstance(payload, BaseModel):
        raw_payload = payload.model_dump(mode="json")
    elif is_dataclass(payload):
        raw_payload = asdict(payload)
    elif isinstance(payload, dict):
        raw_payload = dict(payload)
    else:
        raise TypeError(
            f"Unsupported websocket payload type: {payload.__class__.__name__}"
        )

    event = _SERVER_EVENT_ADAPTER.validate_python(raw_payload)
    return event.model_dump(mode="json")
