from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from backend.core.transport import RequestModel


class TagDefinitionPayload(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str = ""


class CreateTag(RequestModel):
    tag: TagDefinitionPayload
    type: Literal["create_tag"]


class UpdateTag(RequestModel):
    tag_id: str = Field(min_length=1)
    tag: TagDefinitionPayload
    type: Literal["update_tag"]


class DeleteTag(RequestModel):
    tag_id: str = Field(min_length=1)
    type: Literal["delete_tag"]
