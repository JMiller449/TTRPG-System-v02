from dataclasses import dataclass
from sre_parse import State
from typing import Any, Literal, Optional, Union

from backend.schemas.ipc_types.requests import SocketGroup


@dataclass
class ResponseParent:
    response_id: Optional[str]


@dataclass
class PatchOp:
    op: Literal["set", "inc", "add", "remove"]
    path: str
    value: Any | None = None


@dataclass
class StateSnapshot(ResponseParent):
    state: State
    type: Literal["state_snapshot"] = "state_snapshot"


@dataclass
class StatePatch(ResponseParent):
    type: Literal["state_patch"] = "state_patch"
    request_id: str | None = None
    ops: list[PatchOp] | None = None


@dataclass
class Error(ResponseParent):
    message: str
    type: Literal["error"] = "error"
    request_id: str | None = None


@dataclass
class SocketGroupAssigned(ResponseParent):
    is_dm: bool
    groups: dict[SocketGroup, int]
    type: Literal["socket_group_assigned"] = "socket_group_assigned"
    request_id: str | None = None


@dataclass
class ElevateToDMResponse(ResponseParent):
    success: bool
    is_dm: bool
    reason: str | None = None
    type: Literal["elevate_to_dm_response"] = "elevate_to_dm_response"
    request_id: str | None = None


@dataclass
class ChatUpdateResponse(ResponseParent):
    message: str
    target_group: SocketGroup
    type: Literal["chat_update"] = "chat_update"
    request_id: str | None = None


Responses = Union[
    StateSnapshot,
    StatePatch,
    Error,
    SocketGroupAssigned,
    ElevateToDMResponse,
    ChatUpdateResponse,
]
