# Catalog Organization

## Purpose and boundary

Catalog organization is a reusable, backend-persisted presentation hierarchy
managed by the DM and consumed by authoring and entity-selection surfaces. It
groups definitions and sheet records into nested folders without adding
classification fields to those domain entities.

Folder placement has no gameplay, status, ownership, visibility, permission, or
calculation meaning. Folder mutations remain DM-only. Player snapshots and
patches receive only placements for domain records the player can already see
and the ancestor folders needed to display those placements; unrelated empty
folders and hidden entity IDs remain redacted.

Folder-aware multi-selection may copy current descendant entity IDs into a
feature-owned record, such as an item's selected player-sheet allow-list. The
copied stable IDs are authoritative for that feature; the folder itself never
becomes an authorization principal and later hierarchy changes do not alter
the saved selection.

## State model

[`backend/state/models/catalog.py`](../../backend/state/models/catalog.py)
defines two top-level records:

- `CatalogFolder` has a stable ID, catalog scope, display name, optional parent,
  and sibling position.
- `CatalogEntry` places an existing domain entity at a folder level and sibling
  position. Absence of a placement also means the catalog root.

Current catalog scopes cover actions, attributes, conditions, effects,
formulas, items, item templates, proficiencies, tags, sheet templates, and
spawned sheet instances. Each scope has an independent tree. Folders and
entries cannot cross scopes.

The canonical state roots are `catalog_folders` and `catalog_entries`.
Definitions remain in their existing registries; the organization records only
reference their stable IDs. A state-sync reconciliation step removes a
placement when its referenced domain entity is deleted.

## Mutations and validation

DM-only routes under
[`backend/features/catalog_organization/`](../../backend/features/catalog_organization/)
create and rename folders, move folders or entries, and delete folders.
Mutations use the normal state-sync transaction and patch flow.

The backend enforces:

- valid catalog scopes and existing entry IDs;
- parent folders in the same catalog;
- unique case-insensitive folder names among siblings;
- acyclic folder ancestry;
- nonnegative sibling positions; and
- one placement per catalog entry.

Deleting a folder never deletes domain entities. Its immediate entries and
child folders move to the deleted folder's parent. The request is rejected if
lifting a child would create a duplicate sibling folder name.

## Frontend

[`frontend/src/features/catalogs/CatalogBrowser.tsx`](../../frontend/src/features/catalogs/CatalogBrowser.tsx)
is the shared nested browser. It supplies search, root/folder creation menus,
collapsible folders, rename/delete controls, selection, and native drag-and-drop
for folders and entries. Catalog pages provide entity labels, search text, selection
behavior, creation callbacks, and optional entry rendering.

[`frontend/src/features/catalogs/CatalogEntityPicker.tsx`](../../frontend/src/features/catalogs/CatalogEntityPicker.tsx)
is the consumer-side picker. It projects the same hierarchy into a searchable
popover with folders collapsed by default, nested expansion, keyboard option
navigation, and folder-path search. Inventory addition, template and sheet
assignments, action/effect/condition/formula/proficiency references, encounter
templates, access codes, parties, XP workflows, and spawned-sheet selection all
reuse this picker. Selection still returns only the existing entity ID.

[`frontend/src/features/catalogs/CatalogEntityMultiSelect.tsx`](../../frontend/src/features/catalogs/CatalogEntityMultiSelect.tsx)
provides the corresponding checkbox tree. It supports collapsed folders,
search, individual selection, partial folder states, and descendant bulk
selection while returning only stable entity IDs.

Creating an entity through a folder's `+` action records the chosen target in
frontend presentation state. After the normal feature-owned create request
produces the authoritative entity, the shared creation-target hook submits its
catalog placement. Domain create payloads therefore remain free of display
metadata.

The item editor no longer exposes `category` or `catalog_folder`. Persisted
schema version 40 converts legacy item folder/category text into nested item
folders and entry placements before removing those fields.

Tags use the same organization records. A tag folder such as Damage Types or
Sword Families is only a navigation aid; formulas, inline action-step formulas,
effect selectors, items, and item templates persist selected tag IDs rather
than folder IDs.

## Deliberately deferred

No encounter spawn behavior creates or assigns folders. Encounter automation
may consume the sheet-instance catalog organization in a later change, but it
is not part of this display-structure implementation.

## Principal tests

- [`backend/tests/test_catalog_organization.py`](../../backend/tests/test_catalog_organization.py)
  covers nesting, placement, cycle and scope validation, deletion behavior, and
  player redaction.
- State-store tests cover the schema-40 legacy item migration.
- [`frontend/src/features/catalogs/CatalogBrowser.test.tsx`](../../frontend/src/features/catalogs/CatalogBrowser.test.tsx)
  covers the shared nested presentation.
- Catalog picker and search-popover tests cover collapsed nesting, search
  expansion, and consumer selection.
- Protocol, request-builder, adapter, reducer, and existing feature suites
  cover contract generation and catalog adoption.
