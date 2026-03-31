from __future__ import annotations

from pydantic import BaseModel, Field


class FormulaAliasPayload(BaseModel):
    name: str = Field(min_length=1)
    path: list[str] = Field(min_length=1)


class FormulaPayload(BaseModel):
    aliases: list[FormulaAliasPayload] | None = None
    text: str = Field(min_length=1)


class FormulaDefinitionPayload(BaseModel):
    id: str = Field(min_length=1)
    formula: FormulaPayload
