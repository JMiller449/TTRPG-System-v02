from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from backend.core.transport import PatchOp, RequestModel, ResponseModel


class ResyncState(RequestModel):
    last_seen_version: int | None = None
    type: Literal["resync_state"]


@dataclass
class StateSnapshot(ResponseModel):
    state: dict[str, Any]
    state_version: int
    type: Literal["state_snapshot"] = "state_snapshot"
    request_id: str | None = None


@dataclass
class StatePatch(ResponseModel):
    ops: list[PatchOp] | None = None
    state_version: int = 0
    type: Literal["state_patch"] = "state_patch"
    request_id: str | None = None
