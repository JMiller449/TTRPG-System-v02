from __future__ import annotations

from typing import Literal

from pydantic import Field

from backend.core.transport import RequestModel


class SetContributionPoints(RequestModel):
    instance_id: str = Field(min_length=1)
    value: int = Field(ge=0)
    reason: str = ""
    type: Literal["set_contribution_points"]


class AdjustContributionPoints(RequestModel):
    instance_id: str = Field(min_length=1)
    delta: int
    reason: str = ""
    type: Literal["adjust_contribution_points"]
