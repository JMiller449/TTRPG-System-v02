from dataclasses import dataclass
from typing import Literal

from backend.core.transport import RequestModel


class PerformAction(RequestModel):
    sheet_id: str
    action_id: str
    target_sheet_id: str | None = None
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
