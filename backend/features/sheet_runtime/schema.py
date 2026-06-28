from dataclasses import dataclass
from typing import Literal

from pydantic import Field

from backend.core.transport import RequestModel
from backend.state.models.damage import DamageType


class PerformAction(RequestModel):
    sheet_id: str = Field(min_length=1)
    action_id: str = Field(min_length=1)
    source_item_relationship_id: str | None = Field(default=None, min_length=1)
    target_sheet_id: str | None = Field(default=None, min_length=1)
    roll_mode: Literal["normal", "advantage", "disadvantage", "critical"] = "normal"
    type: Literal["perform_action"]


class ApplyInstancedSheetDamage(RequestModel):
    instance_id: str = Field(min_length=1)
    amount: float = Field(ge=0, allow_inf_nan=False)
    damage_type: DamageType
    type: Literal["apply_instanced_sheet_damage"]


@dataclass
class ActionExecuted:
    response_id: str | None
    sheet_id: str
    action_id: str
    applied_mutations: list[str]
    emitted_messages: list[str]
    type: Literal["action_executed"] = "action_executed"
    request_id: str | None = None
