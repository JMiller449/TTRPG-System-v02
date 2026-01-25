from dataclasses import dataclass
from sre_parse import State
from typing import Any, Literal, Optional, Union


# for responses to inherit
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
    state: State  # TODO: probably hide non player visable etc
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


# Response to client
Responses = Union[StateSnapshot, StatePatch, Error]
