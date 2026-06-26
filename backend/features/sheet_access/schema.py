from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import Field

from backend.core.transport import RequestModel, ResponseModel


class GenerateSheetAccessCode(RequestModel):
    sheet_id: str = Field(min_length=1)
    instance_id: str | None = None
    type: Literal["generate_sheet_access_code"]


class GetSheetAccessCodes(RequestModel):
    type: Literal["get_sheet_access_codes"]


class ClaimSheetAccessCode(RequestModel):
    code: str = Field(min_length=1)
    type: Literal["claim_sheet_access_code"]


@dataclass
class SheetAccessCodePayload:
    code: str
    sheet_id: str
    instance_id: str | None = None
    active: bool = True


@dataclass
class SheetAccessCodes(ResponseModel):
    codes: list[SheetAccessCodePayload]
    type: Literal["sheet_access_codes"] = "sheet_access_codes"
    request_id: str | None = None


@dataclass
class SheetAccessClaimed(ResponseModel):
    sheet_id: str
    instance_id: str
    type: Literal["sheet_access_claimed"] = "sheet_access_claimed"
    request_id: str | None = None
