from __future__ import annotations

from typing import Literal

from pydantic import Field, field_validator

from backend.core.transport import RequestModel
from backend.state.models.catalog import CatalogKey


class CreateCatalogFolder(RequestModel):
    folder_id: str = Field(min_length=1)
    catalog: CatalogKey
    name: str = Field(min_length=1)
    parent_id: str | None = None
    type: Literal["create_catalog_folder"]

    @field_validator("folder_id", "name")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be blank.")
        return normalized

    @field_validator("parent_id")
    @classmethod
    def normalize_parent_id(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class RenameCatalogFolder(RequestModel):
    folder_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    type: Literal["rename_catalog_folder"]

    @field_validator("folder_id", "name")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be blank.")
        return normalized


class MoveCatalogNode(RequestModel):
    catalog: CatalogKey
    node_type: Literal["folder", "entry"]
    node_id: str = Field(min_length=1)
    parent_id: str | None = None
    position: int | None = Field(default=None, ge=0)
    type: Literal["move_catalog_node"]

    @field_validator("node_id")
    @classmethod
    def normalize_node_id(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be blank.")
        return normalized

    @field_validator("parent_id")
    @classmethod
    def normalize_parent_id(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class DeleteCatalogFolder(RequestModel):
    folder_id: str = Field(min_length=1)
    type: Literal["delete_catalog_folder"]

    @field_validator("folder_id")
    @classmethod
    def normalize_folder_id(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be blank.")
        return normalized
