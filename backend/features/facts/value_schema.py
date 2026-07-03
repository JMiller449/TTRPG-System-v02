from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

class FactProtocolModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class NumberFactValuePayload(FactProtocolModel):
    type: Literal["number"]
    value: float
    formula: None = None


class FactFormulaAliasPayload(FactProtocolModel):
    name: str
    path: list[str]


class FactFormulaPayload(FactProtocolModel):
    aliases: list[FactFormulaAliasPayload] | None
    text: str
    tags: list[str] = Field(default_factory=list)


class FormulaFactValuePayload(FactProtocolModel):
    type: Literal["formula"]
    formula: FactFormulaPayload
    value: None = None


class BooleanFactValuePayload(FactProtocolModel):
    type: Literal["boolean"]
    value: bool
    formula: None = None


class TextFactValuePayload(FactProtocolModel):
    type: Literal["text"]
    value: str
    formula: None = None


class EnumFactValuePayload(FactProtocolModel):
    type: Literal["enum"]
    value: str
    formula: None = None


class ReferenceFactValuePayload(FactProtocolModel):
    type: Literal["reference"]
    value: str
    formula: None = None


class ListFactValuePayload(FactProtocolModel):
    type: Literal["list"]
    value: list[str]
    formula: None = None


FactValuePayload = Annotated[
    NumberFactValuePayload
    | FormulaFactValuePayload
    | BooleanFactValuePayload
    | TextFactValuePayload
    | EnumFactValuePayload
    | ReferenceFactValuePayload
    | ListFactValuePayload,
    Field(discriminator="type"),
]


class FactDefinitionPayload(FactProtocolModel):
    id: str
    name: str
    description: str = ""
    subject_types: list[Literal["sheet", "item", "action"]]
    value_type: Literal["number", "boolean", "text", "enum", "reference", "list"]
    default_value: FactValuePayload
    unit: str = ""
    visibility: Literal["public", "gm_only"] = "public"
    validation_options: list[str] = Field(default_factory=list)
    reference_kind: str | None = None
    required: bool = False
    required_profile: Literal["weapon"] | None = None
    backend_owned: bool = False


class FactBridgePayload(FactProtocolModel):
    relationship_id: str
    fact_id: str
    value: FactValuePayload
    evaluated_value: float | int | bool | str | list[str] | None = None
    evaluation_error: str | None = None
