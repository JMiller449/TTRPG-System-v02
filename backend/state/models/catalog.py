from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias


CatalogKey: TypeAlias = Literal[
    "actions",
    "attributes",
    "conditions",
    "effects",
    "formulas",
    "item_templates",
    "items",
    "proficiencies",
    "sheet_instances",
    "sheet_templates",
    "tags",
]

CATALOG_KEYS: tuple[CatalogKey, ...] = (
    "actions",
    "attributes",
    "conditions",
    "effects",
    "formulas",
    "item_templates",
    "items",
    "proficiencies",
    "sheet_instances",
    "sheet_templates",
    "tags",
)


@dataclass
class CatalogFolder:
    id: str
    catalog: CatalogKey
    name: str
    parent_id: str | None = None
    position: int = 0

    def __post_init__(self) -> None:
        self.id = self.id.strip()
        self.name = self.name.strip()
        if not self.id:
            raise ValueError("Catalog folder ID is required.")
        if self.catalog not in CATALOG_KEYS:
            raise ValueError(f"Unsupported catalog '{self.catalog}'.")
        if not self.name:
            raise ValueError("Catalog folder name is required.")
        if self.parent_id is not None:
            self.parent_id = self.parent_id.strip() or None
        if isinstance(self.position, bool) or not isinstance(self.position, int):
            raise ValueError("Catalog folder position must be an integer.")
        if self.position < 0:
            raise ValueError("Catalog folder position cannot be negative.")

    @classmethod
    def from_dict(cls, raw: dict) -> "CatalogFolder":
        return cls(
            id=raw["id"],
            catalog=raw["catalog"],
            name=raw["name"],
            parent_id=raw.get("parent_id"),
            position=raw.get("position", 0),
        )


@dataclass
class CatalogEntry:
    id: str
    catalog: CatalogKey
    entry_id: str
    folder_id: str | None = None
    position: int = 0

    def __post_init__(self) -> None:
        self.id = self.id.strip()
        self.entry_id = self.entry_id.strip()
        if not self.id:
            raise ValueError("Catalog entry placement ID is required.")
        if self.catalog not in CATALOG_KEYS:
            raise ValueError(f"Unsupported catalog '{self.catalog}'.")
        if not self.entry_id:
            raise ValueError("Catalog entry ID is required.")
        if self.folder_id is not None:
            self.folder_id = self.folder_id.strip() or None
        if isinstance(self.position, bool) or not isinstance(self.position, int):
            raise ValueError("Catalog entry position must be an integer.")
        if self.position < 0:
            raise ValueError("Catalog entry position cannot be negative.")

    @classmethod
    def from_dict(cls, raw: dict) -> "CatalogEntry":
        return cls(
            id=raw["id"],
            catalog=raw["catalog"],
            entry_id=raw["entry_id"],
            folder_id=raw.get("folder_id"),
            position=raw.get("position", 0),
        )


def catalog_entry_placement_id(catalog: CatalogKey, entry_id: str) -> str:
    return f"{catalog}:{entry_id}"


def validate_catalog_organization(
    folders: dict[str, CatalogFolder],
    entries: dict[str, CatalogEntry],
    *,
    entity_ids: dict[CatalogKey, set[str]],
) -> None:
    sibling_names: set[tuple[CatalogKey, str | None, str]] = set()
    for folder_id, folder in folders.items():
        if folder_id != folder.id:
            raise ValueError(
                f"Catalog folder key '{folder_id}' does not match ID '{folder.id}'."
            )
        parent = folders.get(folder.parent_id) if folder.parent_id is not None else None
        if folder.parent_id is not None and parent is None:
            raise ValueError(
                f"Catalog folder '{folder.id}' references missing parent "
                f"'{folder.parent_id}'."
            )
        if parent is not None and parent.catalog != folder.catalog:
            raise ValueError(
                f"Catalog folder '{folder.id}' cannot cross catalog boundaries."
            )
        sibling_key = (
            folder.catalog,
            folder.parent_id,
            folder.name.casefold(),
        )
        if sibling_key in sibling_names:
            raise ValueError(
                f"Catalog folder '{folder.name}' already exists at this level."
            )
        sibling_names.add(sibling_key)

        visited = {folder.id}
        ancestor = parent
        while ancestor is not None:
            if ancestor.id in visited:
                raise ValueError("Catalog folders cannot contain a parent cycle.")
            visited.add(ancestor.id)
            ancestor = (
                folders.get(ancestor.parent_id)
                if ancestor.parent_id is not None
                else None
            )

    seen_entries: set[tuple[CatalogKey, str]] = set()
    for placement_id, entry in entries.items():
        if placement_id != entry.id:
            raise ValueError(
                f"Catalog entry key '{placement_id}' does not match ID '{entry.id}'."
            )
        expected_id = catalog_entry_placement_id(entry.catalog, entry.entry_id)
        if entry.id != expected_id:
            raise ValueError(
                f"Catalog entry placement '{entry.id}' must use ID '{expected_id}'."
            )
        identity = (entry.catalog, entry.entry_id)
        if identity in seen_entries:
            raise ValueError(
                f"Catalog entry '{entry.entry_id}' has more than one placement."
            )
        seen_entries.add(identity)
        if entry.entry_id not in entity_ids[entry.catalog]:
            raise ValueError(
                f"Catalog entry '{entry.entry_id}' does not exist in "
                f"'{entry.catalog}'."
            )
        if entry.folder_id is None:
            continue
        folder = folders.get(entry.folder_id)
        if folder is None:
            raise ValueError(
                f"Catalog entry '{entry.entry_id}' references missing folder "
                f"'{entry.folder_id}'."
            )
        if folder.catalog != entry.catalog:
            raise ValueError(
                f"Catalog entry '{entry.entry_id}' cannot cross catalog boundaries."
            )
