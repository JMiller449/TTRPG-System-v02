from dataclasses import dataclass
from typing import Literal

from backend.core.transport import RequestModel
from backend.features.sheet_admin.formulas.schema import FormulaPayload


class FocusSheet(RequestModel):
    sheet_id: str
    type: Literal["focus_sheet"]


@dataclass
class FocusSheetResponse:
    response_id: str | None
    sheet_id: str
    type: Literal["focus_sheet_response"] = "focus_sheet_response"
    request_id: str | None = None


class RollBasicCheck(RequestModel):
    label: str
    formula: FormulaPayload
    type: Literal["roll_basic_check"]


@dataclass
class BasicCheckRolled:
    response_id: str | None
    sheet_id: str
    label: str
    roll: int
    modifier: int | float
    total: int | float
    expanded_formula: str
    type: Literal["basic_check_rolled"] = "basic_check_rolled"
    request_id: str | None = None


class PerformAction(RequestModel):
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
