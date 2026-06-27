from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import Field

from backend.core.transport import RequestModel, ResponseModel


class GetXpTracker(RequestModel):
    type: Literal["get_xp_tracker"]


class SetSheetXpRequired(RequestModel):
    sheet_id: str = Field(min_length=1)
    xp_required: int = Field(ge=0)
    type: Literal["set_sheet_xp_required"]


class SetMobXpValue(RequestModel):
    mob_sheet_id: str = Field(min_length=1)
    xp_value: int = Field(ge=0)
    type: Literal["set_mob_xp_value"]


class SetSheetMobKillCount(RequestModel):
    sheet_id: str = Field(min_length=1)
    mob_sheet_id: str = Field(min_length=1)
    count: int = Field(ge=0)
    type: Literal["set_sheet_mob_kill_count"]


@dataclass(frozen=True)
class XpTrackerMob:
    sheet_id: str
    name: str
    count: int
    xp_value: int | None = None
    xp_earned: int | None = None


@dataclass(frozen=True)
class XpTrackerSheet:
    sheet_id: str
    name: str
    mobs: list[XpTrackerMob]
    current_xp: int | None = None
    xp_required: int | None = None
    ready_to_level: bool | None = None


@dataclass
class XpTracker(ResponseModel):
    can_view_progress: bool
    sheets: list[XpTrackerSheet]
    type: Literal["xp_tracker"] = "xp_tracker"
    request_id: str | None = None
