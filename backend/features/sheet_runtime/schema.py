from dataclasses import dataclass
from typing import Literal

from pydantic import Field

from backend.core.transport import RequestModel

ActionRollMode = Literal["normal", "advantage", "disadvantage"]
ActionVisibility = Literal["public", "gm_only"]


class PerformAction(RequestModel):
    sheet_id: str = Field(min_length=1)
    action_id: str = Field(min_length=1)
    target_sheet_id: str | None = Field(default=None, min_length=1)
    roll_mode: ActionRollMode = "normal"
    visibility: ActionVisibility = "public"
    type: Literal["perform_action"]


@dataclass
class ActionExecuted:
    response_id: str | None
    sheet_id: str
    action_id: str
    applied_mutations: list[str]
    emitted_messages: list[str]
    type: Literal["action_executed"] = "action_executed"
    request_id: str | None = None
