from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, Field

SocketGroup = Literal["dms", "players"]


class RequestModel(BaseModel):
    request_id: str | None = Field(default=None, min_length=1, max_length=128)


@dataclass
class ResponseModel:
    response_id: str | None


@dataclass
class PatchOp:
    op: Literal["set", "inc", "add", "remove"]
    path: str
    value: Any | None = None


@dataclass
class Error(ResponseModel):
    reason: str
    type: Literal["error"] = "error"
    request_id: str | None = None
