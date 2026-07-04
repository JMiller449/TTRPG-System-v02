from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

class AttributeProtocolModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class NumberAttributeValuePayload(AttributeProtocolModel):
    type: Literal["number"]
    value: float
    formula: None = None


class AttributeFormulaAliasPayload(AttributeProtocolModel):
    name: str
    path: list[str]


class AttributeFormulaPayload(AttributeProtocolModel):
    aliases: list[AttributeFormulaAliasPayload] | None
    text: str
    tags: list[str] = Field(default_factory=list)


class FormulaAttributeValuePayload(AttributeProtocolModel):
    type: Literal["formula"]
    formula: AttributeFormulaPayload
    value: None = None


class BooleanAttributeValuePayload(AttributeProtocolModel):
    type: Literal["boolean"]
    value: bool
    formula: None = None


class TextAttributeValuePayload(AttributeProtocolModel):
    type: Literal["text"]
    value: str
    formula: None = None


class EnumAttributeValuePayload(AttributeProtocolModel):
    type: Literal["enum"]
    value: str
    formula: None = None


class ReferenceAttributeValuePayload(AttributeProtocolModel):
    type: Literal["reference"]
    value: str
    formula: None = None


class ListAttributeValuePayload(AttributeProtocolModel):
    type: Literal["list"]
    value: list[str]
    formula: None = None


AttributeValuePayload = Annotated[
    NumberAttributeValuePayload
    | FormulaAttributeValuePayload
    | BooleanAttributeValuePayload
    | TextAttributeValuePayload
    | EnumAttributeValuePayload
    | ReferenceAttributeValuePayload
    | ListAttributeValuePayload,
    Field(discriminator="type"),
]


class AttributeDefinitionPayload(AttributeProtocolModel):
    id: str
    name: str
    description: str = ""
    subject_types: list[Literal["sheet", "item", "action"]]
    value_type: Literal["number", "boolean", "text", "enum", "reference", "list"]
    default_value: AttributeValuePayload
    unit: str = ""
    visibility: Literal["public", "gm_only"] = "public"
    validation_options: list[str] = Field(default_factory=list)
    reference_kind: str | None = None
    required: bool = False
    required_profile: Literal["weapon"] | None = None
    backend_owned: bool = False


class AttributeBridgePayload(AttributeProtocolModel):
    relationship_id: str
    attribute_id: str
    value: AttributeValuePayload
    evaluated_value: float | int | bool | str | list[str] | None = None
    evaluation_error: str | None = None
