from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from backend.core.transport import RequestModel


class FormulaAliasPayload(BaseModel):
    name: str = Field(min_length=1)
    path: list[str] = Field(min_length=1)


class FormulaPayload(BaseModel):
    aliases: list[FormulaAliasPayload] | None = None
    text: str = Field(min_length=1)


class FormulaDefinitionPayload(BaseModel):
    id: str = Field(min_length=1)
    formula: FormulaPayload


class CreateFormula(RequestModel):
    formula: FormulaDefinitionPayload
    type: Literal["create_formula"]


class UpdateFormula(RequestModel):
    formula_id: str = Field(min_length=1)
    formula: FormulaDefinitionPayload
    type: Literal["update_formula"]


class DeleteFormula(RequestModel):
    formula_id: str = Field(min_length=1)
    type: Literal["delete_formula"]
