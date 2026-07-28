from __future__ import annotations

from copy import deepcopy

from backend.core.transport import PatchOp
from backend.features.catalog_organization.schema import (
    CreateCatalogFolder,
    DeleteCatalogFolder,
    MoveCatalogNode,
    RenameCatalogFolder,
)
from backend.features.state_sync.service import state_sync_service
from backend.state.models.catalog import (
    CatalogEntry,
    CatalogFolder,
    CatalogKey,
    catalog_entry_placement_id,
)
from backend.state.models.state import State


def _catalog_collection(state: State, catalog: CatalogKey) -> dict:
    return {
        "actions": state.actions,
        "attributes": state.attributes,
        "conditions": state.condition_presets,
        "effects": state.standalone_effects,
        "formulas": state.formulas,
        "item_templates": state.item_templates,
        "items": state.items,
        "proficiencies": state.proficiencies,
        "sheet_instances": state.instanced_sheets,
        "sheet_templates": state.sheets,
        "tags": state.tags,
    }[catalog]


def _validate_parent(
    folders: dict[str, CatalogFolder],
    *,
    catalog: CatalogKey,
    parent_id: str | None,
) -> None:
    if parent_id is None:
        return
    parent = folders.get(parent_id)
    if parent is None:
        raise ValueError(f"Catalog folder '{parent_id}' does not exist.")
    if parent.catalog != catalog:
        raise ValueError("Catalog folders cannot cross catalog boundaries.")


def _validate_unique_name(
    folders: dict[str, CatalogFolder],
    *,
    catalog: CatalogKey,
    parent_id: str | None,
    name: str,
    excluding_id: str | None = None,
) -> None:
    duplicate = next(
        (
            folder
            for folder in folders.values()
            if folder.id != excluding_id
            and folder.catalog == catalog
            and folder.parent_id == parent_id
            and folder.name.casefold() == name.casefold()
        ),
        None,
    )
    if duplicate is not None:
        raise ValueError(f"Folder '{name}' already exists at this level.")


def _ordered_siblings(
    folders: dict[str, CatalogFolder],
    entries: dict[str, CatalogEntry],
    *,
    catalog: CatalogKey,
    parent_id: str | None,
    excluding: tuple[str, str] | None = None,
) -> list[tuple[str, str]]:
    siblings = [
        ("folder", folder.id, folder.position)
        for folder in folders.values()
        if folder.catalog == catalog
        and folder.parent_id == parent_id
        and excluding != ("folder", folder.id)
    ]
    siblings.extend(
        ("entry", entry.id, entry.position)
        for entry in entries.values()
        if entry.catalog == catalog
        and entry.folder_id == parent_id
        and excluding != ("entry", entry.id)
    )
    siblings.sort(key=lambda value: (value[2], value[0], value[1]))
    return [(kind, node_id) for kind, node_id, _ in siblings]


def _position_siblings(
    folders: dict[str, CatalogFolder],
    entries: dict[str, CatalogEntry],
    *,
    catalog: CatalogKey,
    parent_id: str | None,
    moving: tuple[str, str] | None = None,
    position: int | None = None,
) -> None:
    siblings = _ordered_siblings(
        folders,
        entries,
        catalog=catalog,
        parent_id=parent_id,
        excluding=moving,
    )
    if moving is not None:
        insert_at = len(siblings) if position is None else min(position, len(siblings))
        siblings.insert(insert_at, moving)
    for index, (kind, node_id) in enumerate(siblings):
        if kind == "folder":
            folders[node_id].position = index
        else:
            entries[node_id].position = index


def _set_organization(
    state: State,
    folders: dict[str, CatalogFolder],
    entries: dict[str, CatalogEntry],
) -> list[PatchOp]:
    return [
        state_sync_service.set_mutation(
            state,
            state_sync_service.join_path("catalog_folders"),
            folders,
        ),
        state_sync_service.set_mutation(
            state,
            state_sync_service.join_path("catalog_entries"),
            entries,
        ),
    ]


async def create_catalog_folder(request: CreateCatalogFolder) -> None:
    def mutation(state: State) -> tuple[None, list[PatchOp]]:
        folders = deepcopy(state.catalog_folders)
        entries = deepcopy(state.catalog_entries)
        if request.folder_id in folders:
            raise ValueError(f"Catalog folder '{request.folder_id}' already exists.")
        _validate_parent(folders, catalog=request.catalog, parent_id=request.parent_id)
        _validate_unique_name(
            folders,
            catalog=request.catalog,
            parent_id=request.parent_id,
            name=request.name,
        )
        folder = CatalogFolder(
            id=request.folder_id,
            catalog=request.catalog,
            name=request.name,
            parent_id=request.parent_id,
        )
        folders[folder.id] = folder
        _position_siblings(
            folders,
            entries,
            catalog=folder.catalog,
            parent_id=folder.parent_id,
            moving=("folder", folder.id),
        )
        return None, _set_organization(state, folders, entries)

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def rename_catalog_folder(request: RenameCatalogFolder) -> None:
    def mutation(state: State) -> tuple[None, list[PatchOp]]:
        folders = deepcopy(state.catalog_folders)
        entries = deepcopy(state.catalog_entries)
        folder = folders.get(request.folder_id)
        if folder is None:
            raise ValueError(f"Catalog folder '{request.folder_id}' does not exist.")
        _validate_unique_name(
            folders,
            catalog=folder.catalog,
            parent_id=folder.parent_id,
            name=request.name,
            excluding_id=folder.id,
        )
        if folder.name == request.name:
            return None, []
        folder.name = request.name
        return None, _set_organization(state, folders, entries)

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def move_catalog_node(request: MoveCatalogNode) -> None:
    def mutation(state: State) -> tuple[None, list[PatchOp]]:
        folders = deepcopy(state.catalog_folders)
        entries = deepcopy(state.catalog_entries)
        _validate_parent(folders, catalog=request.catalog, parent_id=request.parent_id)

        if request.node_type == "folder":
            folder = folders.get(request.node_id)
            if folder is None:
                raise ValueError(f"Catalog folder '{request.node_id}' does not exist.")
            if folder.catalog != request.catalog:
                raise ValueError("Catalog folders cannot cross catalog boundaries.")
            _validate_unique_name(
                folders,
                catalog=folder.catalog,
                parent_id=request.parent_id,
                name=folder.name,
                excluding_id=folder.id,
            )
            ancestor_id = request.parent_id
            while ancestor_id is not None:
                if ancestor_id == folder.id:
                    raise ValueError("A catalog folder cannot contain itself.")
                ancestor = folders.get(ancestor_id)
                ancestor_id = ancestor.parent_id if ancestor is not None else None
            old_parent_id = folder.parent_id
            folder.parent_id = request.parent_id
            _position_siblings(
                folders,
                entries,
                catalog=request.catalog,
                parent_id=old_parent_id,
            )
            _position_siblings(
                folders,
                entries,
                catalog=request.catalog,
                parent_id=request.parent_id,
                moving=("folder", folder.id),
                position=request.position,
            )
        else:
            if request.node_id not in _catalog_collection(state, request.catalog):
                raise ValueError(
                    f"Catalog entry '{request.node_id}' does not exist in "
                    f"'{request.catalog}'."
                )
            placement_id = catalog_entry_placement_id(request.catalog, request.node_id)
            placement = entries.get(placement_id)
            old_parent_id = placement.folder_id if placement is not None else None
            if placement is None:
                placement = CatalogEntry(
                    id=placement_id,
                    catalog=request.catalog,
                    entry_id=request.node_id,
                )
                entries[placement_id] = placement
            placement.folder_id = request.parent_id
            _position_siblings(
                folders,
                entries,
                catalog=request.catalog,
                parent_id=old_parent_id,
            )
            _position_siblings(
                folders,
                entries,
                catalog=request.catalog,
                parent_id=request.parent_id,
                moving=("entry", placement.id),
                position=request.position,
            )
        return None, _set_organization(state, folders, entries)

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def delete_catalog_folder(request: DeleteCatalogFolder) -> None:
    def mutation(state: State) -> tuple[None, list[PatchOp]]:
        folders = deepcopy(state.catalog_folders)
        entries = deepcopy(state.catalog_entries)
        folder = folders.get(request.folder_id)
        if folder is None:
            raise ValueError(f"Catalog folder '{request.folder_id}' does not exist.")
        parent_id = folder.parent_id
        for child in folders.values():
            if child.parent_id != folder.id:
                continue
            if any(
                candidate.id not in {child.id, folder.id}
                and candidate.catalog == folder.catalog
                and candidate.parent_id == parent_id
                and candidate.name.casefold() == child.name.casefold()
                for candidate in folders.values()
            ):
                raise ValueError(
                    f"Move or rename child folder '{child.name}' before deleting "
                    f"'{folder.name}'."
                )
        del folders[folder.id]
        for child in folders.values():
            if child.parent_id == folder.id:
                child.parent_id = parent_id
        for entry in entries.values():
            if entry.folder_id == folder.id:
                entry.folder_id = parent_id
        _position_siblings(
            folders,
            entries,
            catalog=folder.catalog,
            parent_id=parent_id,
        )
        return None, _set_organization(state, folders, entries)

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


def synchronize_catalog_entries_mutation(
    state: State,
) -> list[PatchOp]:
    entries = deepcopy(state.catalog_entries)
    stale_ids = [
        placement_id
        for placement_id, placement in entries.items()
        if placement.entry_id not in _catalog_collection(state, placement.catalog)
    ]
    if not stale_ids:
        return []
    for placement_id in stale_ids:
        del entries[placement_id]
    return [
        state_sync_service.set_mutation(
            state,
            state_sync_service.join_path("catalog_entries"),
            entries,
        )
    ]
