from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import Field

from backend.core.transport import RequestModel, ResponseModel


class GetXpTracker(RequestModel):
    type: Literal["get_xp_tracker"]


class SetSheetXpRequired(RequestModel):
    sheet_id: str = Field(min_length=1)
    xp_required: float = Field(ge=0)
    type: Literal["set_sheet_xp_required"]


class SetMobXpValue(RequestModel):
    mob_sheet_id: str = Field(min_length=1)
    xp_value: float = Field(ge=0)
    type: Literal["set_mob_xp_value"]


class SaveParty(RequestModel):
    party_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    member_instance_ids: list[str] = Field(default_factory=list)
    type: Literal["save_party"]


class DeleteParty(RequestModel):
    party_id: str = Field(min_length=1)
    type: Literal["delete_party"]


class RecordKill(RequestModel):
    kill_id: str = Field(min_length=1)
    credited_instance_id: str = Field(min_length=1)
    monster_sheet_id: str | None = None
    monster_name: str | None = None
    base_xp: float | None = Field(default=None, ge=0)
    occurred_at: str | None = None
    notes: str = ""
    type: Literal["record_kill"]


class UpdateKill(RequestModel):
    kill_id: str = Field(min_length=1)
    monster_sheet_id: str | None = None
    monster_name: str = Field(min_length=1)
    base_xp: float = Field(ge=0)
    participant_instance_ids: list[str] = Field(min_length=1)
    occurred_at: str = Field(min_length=1)
    notes: str = ""
    type: Literal["update_kill"]


class DeleteKill(RequestModel):
    kill_id: str = Field(min_length=1)
    type: Literal["delete_kill"]


class SaveXpAdjustment(RequestModel):
    adjustment_id: str = Field(min_length=1)
    instance_id: str = Field(min_length=1)
    amount: float
    reason: str = ""
    occurred_at: str | None = None
    type: Literal["save_xp_adjustment"]


class DeleteXpAdjustment(RequestModel):
    adjustment_id: str = Field(min_length=1)
    type: Literal["delete_xp_adjustment"]


@dataclass(frozen=True)
class XpTrackerPartyMember:
    instance_id: str
    name: str


@dataclass(frozen=True)
class XpTrackerParty:
    id: str
    name: str
    members: list[XpTrackerPartyMember]


@dataclass(frozen=True)
class XpTrackerKillParticipant:
    instance_id: str
    name: str


@dataclass(frozen=True)
class XpTrackerKill:
    id: str
    monster_name: str
    base_xp: float
    participants: list[XpTrackerKillParticipant]
    participant_count: int
    xp_percentage: float
    xp_per_participant: float
    occurred_at: str
    monster_sheet_id: str | None = None
    notes: str = ""


@dataclass(frozen=True)
class XpTrackerAdjustment:
    id: str
    instance_id: str
    instance_name: str
    amount: float
    reason: str
    occurred_at: str


@dataclass(frozen=True)
class XpTrackerSheet:
    instance_id: str
    sheet_id: str
    name: str
    kills: list[XpTrackerKill]
    adjustments: list[XpTrackerAdjustment]
    current_xp: float
    xp_required: float
    ready_to_level: bool


@dataclass(frozen=True)
class XpTrackerMob:
    sheet_id: str
    name: str
    xp_value: float


@dataclass
class XpTracker(ResponseModel):
    can_manage: bool
    sheets: list[XpTrackerSheet]
    parties: list[XpTrackerParty]
    kills: list[XpTrackerKill]
    adjustments: list[XpTrackerAdjustment]
    mobs: list[XpTrackerMob]
    type: Literal["xp_tracker"] = "xp_tracker"
    request_id: str | None = None
