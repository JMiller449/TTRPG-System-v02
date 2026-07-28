from __future__ import annotations

from backend.features.sheet_admin.tags.schema import CreateTag, DeleteTag, UpdateTag
from backend.features.state_sync.service import state_sync_service
from backend.state.models.state import State
from backend.state.models.tag import TagDefinition, collect_tag_references


async def create_tag(request: CreateTag) -> None:
    tag = TagDefinition(
        id=request.tag.id,
        name=request.tag.name,
        description=request.tag.description,
    )

    def mutation(state: State) -> tuple[None, list]:
        if tag.id in state.tags:
            raise ValueError(f"Tag '{tag.id}' already exists.")
        path = state_sync_service.join_path("tags", tag.id)
        return None, [state_sync_service.add_mutation(state, path, tag)]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def update_tag(request: UpdateTag) -> None:
    if request.tag.id != request.tag_id:
        raise ValueError("Tag ID cannot be changed.")
    tag = TagDefinition(
        id=request.tag.id,
        name=request.tag.name,
        description=request.tag.description,
    )

    def mutation(state: State) -> tuple[None, list]:
        if request.tag_id not in state.tags:
            raise ValueError(f"Tag '{request.tag_id}' does not exist.")
        path = state_sync_service.join_path("tags", request.tag_id)
        return None, [state_sync_service.set_mutation(state, path, tag)]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def delete_tag(request: DeleteTag) -> None:
    def mutation(state: State) -> tuple[None, list]:
        if request.tag_id not in state.tags:
            raise ValueError(f"Tag '{request.tag_id}' does not exist.")
        serialized = state.to_dict(include_private=True)
        serialized.pop("tags", None)
        if request.tag_id in collect_tag_references(serialized):
            raise ValueError(
                f"Tag '{request.tag_id}' cannot be deleted while it is referenced."
            )
        path = state_sync_service.join_path("tags", request.tag_id)
        _, op = state_sync_service.remove_mutation(state, path)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
