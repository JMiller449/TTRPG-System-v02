from __future__ import annotations

from typing import Any, Literal

from backend.core.transport import RequestModel

AdminEntityKind = Literal["sheet", "item", "action", "formula", "stat"]
CrudEntity = dict[str, Any]


class CreateEntity(RequestModel):
    entity: CrudEntity
    entity_kind: AdminEntityKind | None = None
    type: Literal["create_entity"]


class UpdateEntity(RequestModel):
    entity_id: str
    entity_partial: dict[str, Any]
    entity_kind: AdminEntityKind | None = None
    type: Literal["update_entity"]


class DeleteEntity(RequestModel):
    entity_id: str
    entity_kind: AdminEntityKind | None = None
    type: Literal["delete_entity"]


SheetAdminRequest = CreateEntity | UpdateEntity | DeleteEntity
