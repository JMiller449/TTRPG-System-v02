from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from backend.core.transport import RequestModel, ResponseModel

VariableRoot = Literal["state", "sheet", "instance"]
VariableValueType = Literal["number", "formula", "resource"]
VariableEditableRole = Literal["unauthenticated", "player", "dm"]


class GetVariableRegistry(RequestModel):
    type: Literal["get_variable_registry"]


@dataclass
class VariablePathMetadata:
    key: str
    label: str
    root: VariableRoot
    path: list[str]
    value_type: VariableValueType
    editable_roles: list[VariableEditableRole]
    formula_backed: bool = False
    description: str = ""


@dataclass
class VariableRegistry(ResponseModel):
    variables: list[VariablePathMetadata]
    type: Literal["variable_registry"] = "variable_registry"
    request_id: str | None = None
