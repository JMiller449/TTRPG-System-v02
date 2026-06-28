from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from backend.core.transport import RequestModel
from backend.state.models.formula import normalize_formula_tags


class FormulaAliasPayload(BaseModel):
    name: str = Field(min_length=1)
    path: list[str] = Field(min_length=1)


class FormulaPayload(BaseModel):
    aliases: list[FormulaAliasPayload] | None = None
    text: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, value: list[str]) -> list[str]:
        return normalize_formula_tags(value)


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
