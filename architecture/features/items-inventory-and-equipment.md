# Items, Inventory, and Equipment

## Purpose and model

The item system separates reusable catalog definitions from per-character
inventory relationships. It supports equipment, consumables, ordinary carried
objects, storage containment, item-authored effects, granted actions, managed
tags, reusable item templates, player-visible catalogs, and player item
proposals.

[`backend/state/models/item.py`](../../backend/state/models/item.py) defines:

- `Item`: authored identity, interaction type, descriptive/GM fields, price,
  rank, numeric weight, player-catalog access and approval state, storage
  capacity and carried-weight behavior, managed tag IDs, attributes, action
  grants, and augmentation templates.
- `ItemBridge`: a template or instance relationship with quantity, equipped
  state, definition ID, and optional parent-container relationship.
- `ItemActionGrant`: an action available while carried or equipped, with an
  optional quantity cost.

Templates define starting inventory. Spawning copies those bridges into the
instance; all later quantity, equipment, containment, and runtime effect state
belongs to that instance.

## Item interaction types

- `equippable` items may change equipped state and can activate source-linked
  effects or equipped-only action grants.
- `consumable` items may grant actions that consume quantity after successful
  execution.
- `inventory_only` items are tracked without equipment behavior.

The backend validates interaction-specific authoring rather than relying on
which controls the frontend happens to show.

## Inventory, containment, and weight

[`backend/features/inventory/service.py`](../../backend/features/inventory/service.py)
validates an instance inventory as a graph. Items can be at the root or inside
a bridge whose definition is a storage container. Moves reject missing or
stacked destinations, self-containment, cycles, equipped items, and other
invalid relationships. A container may define a finite nonnegative contents
weight limit or remain explicitly unlimited. Moves, quantity changes, and item
definition edits reject any resulting over-capacity inventory. Nested
containers contribute their effective loaded weight to their parent, so a
weight-negating inner container contributes only its own definition weight.
Nonempty containers cannot be removed until their contents are moved.
Deleting an item definition is a broader DM cascade: every template and
instance bridge referencing that definition is removed atomically, including
equipped copies. Surviving entries directly inside a deleted container are
promoted to root inventory, and normal state-sync reconciliation removes
equipment-owned effects and refreshes weight projections.

Carried weight is a backend-derived projection. It multiplies definition
weight by quantity, includes equipped items, traverses containment, and honors
containers configured to ignore contained weight. Item weights must be finite
nonnegative numeric pounds. The evaluated total and per-container current
contents weights are sent in snapshots and patches; the frontend only formats
them.

## Equipment, effects, and actions

`set_instanced_sheet_item_equipped` checks assignment, quantity, interaction
type, and current instance ownership. The state-sync reconciliation hook derives
equipment-owned augmentations from every equipped, in-stock item and removes
them on unequip or depletion. Direct effects are projected from a stable base
so repeated synchronization does not double-apply them.

Action grants are resolved through the exact source `ItemBridge`. Carried or
equipped availability is enforced at execution time. Quantity consumption is
part of the action transaction and occurs only after required Roll20 delivery
succeeds.

Items attach ordinary typed Attributes only when their granted actions or
effects need those values. Standard source-item Attributes include base damage,
governing stat, reach, and proficiency. Weapon family/type and damage-type
classification are managed tags instead of bespoke fields. Items never
automatically receive action grants from a profile: the DM explicitly selects
shared action definitions, and creation validates that every source-item alias
used by a granted action refers to an Attribute attached to the item.

Equipping an item with a valid Proficiency Attribute adds a missing matching
instance proficiency bridge. Its growth rate comes from the proficiency
definition, never from the item. Source-item formulas and `same_source_item`
effect selectors use the relationship ID to distinguish multiple copies of the
same definition.

## Tags and item templates

[`backend/state/models/tag.py`](../../backend/state/models/tag.py) defines the
shared `TagDefinition` registry used by items, formulas embedded in action
steps, reusable formulas, and augmentation tag selectors. Item payloads store
stable tag IDs. Tag folders remain presentation-only and carry no inherited
mechanics.

`item_templates` is a separate DM-only definition registry with its own
Item Templates navigation tab and builder page. The Item Maker remains focused
on creating items: its explicit start screen offers start from scratch or
choose a template. Choosing a template deep-copies its descriptive fields,
tags, Attributes, effects, and action grants into an independent item draft
with new relationship/effect IDs and no player availability. Later template
changes or deletion do not alter items already created from it.

## Catalog visibility and player proposals

DMs author definitions through
[`backend/features/sheet_admin/items/`](../../backend/features/sheet_admin/items/)
and [`frontend/src/features/items/ItemMakerPage.tsx`](../../frontend/src/features/items/ItemMakerPage.tsx).
Each approved definition has backend-authoritative player catalog access:
`none`, `all`, or `selected`. Selected access stores stable spawned
player-sheet instance IDs. The item editor presents those IDs through a
searchable nested sheet-instance folder tree with individual and tri-state
folder selection. Folder selection copies the current descendant IDs into the
item; later folder moves do not change authorization.

The GM item catalog uses the shared top-level
[catalog organization](catalog-organization.md) records. Nested folders and
entry placements reference item IDs without adding classification fields to an
item. Search covers item name, stable ID, and rank. Organization does not
directly affect access, redaction, inventory relationships, or mechanics.
Inventory-add consumers open the shared catalog picker in a focused dialog.
Players see folder placement only for item definitions already visible to them.

Items and item templates have independent catalog trees. Creating either from
a folder's `+` menu queues the normal entity creation followed by a separate
placement request; no folder ID enters the item/template payload.

An assigned player may add one copy of an item allowed for their claimed
instance or remove an eligible item from their own inventory. The backend
checks that stable instance ID for both snapshot visibility and inventory-add
requests. Item allow-lists are private and never sent to players. An
unavailable definition remains visible when needed to render an item the
assigned character already owns. Despawning a selected character or changing
its template to GM-only removes its stale allow-list reference.

Players may propose non-mechanical equippable or inventory-only items. Pending
proposals are visible only to the submitting character and DM. Approval
atomically makes the definition available to all players and grants one copy
to the submitter;
denial removes it. Players cannot propose effects, mechanical attributes,
action grants, consumable behavior, or other DM-owned mechanics.

## Frontend inventory

Character inventory/equipment presentation is implemented under
[`frontend/src/features/sheets/`](../../frontend/src/features/sheets/), while
definition authoring and the proposal form are under
[`frontend/src/features/items/`](../../frontend/src/features/items/). Local
helpers calculate display groupings and labels only; quantities, containment,
weight, equipment eligibility, and action availability remain backend-owned.
The owned inventory is a responsive card grid. Add Existing opens the visible
item catalog in a focused dialog. A GM can open the shared validated Item editor
from the same toolbar; after authoritative creation succeeds, the frontend sends
the normal instance-item attachment request. A player instead opens the existing
non-mechanical proposal form in a dialog, preserving the approval boundary.
Large Item editors keep their heading and save controls reachable while the
editor body scrolls within the viewport.
Item draft Attributes render as compact summary cards inside the editor's
Attributes disclosure. Add Existing opens a nested catalog dialog, and clicking
a card opens its focused draft value or formula editor instead of leaving
attachment and editing controls expanded in the main Item form.
Item-owned equipment effects follow the same compact authoring pattern without
changing their equipment lifecycle: the Item form shows attached effect cards
with inline removal, while Add Effect and card editing navigate to a focused
effect editor within the current Item workspace. This avoids nested dialogs when
the Item builder was itself opened from a character sheet.
DMs and players can drag an unequipped item onto a valid storage card or the
root inventory drop zone. The location selector remains the keyboard and touch
fallback. The shared move route is available to authenticated players only for
their claimed player-sheet instance; DMs retain access to every instance.

## Principal tests

- [`backend/tests/test_sheet_admin_items.py`](../../backend/tests/test_sheet_admin_items.py)
  covers definition authoring, explicit Attributes/action grants, visibility,
  and proposals.
- [`backend/tests/test_sheet_admin_tags_and_item_templates.py`](../../backend/tests/test_sheet_admin_tags_and_item_templates.py)
  covers managed-tag references and item-template CRUD.
- [`backend/tests/test_sheet_admin_item_bridges.py`](../../backend/tests/test_sheet_admin_item_bridges.py)
  and [`backend/tests/test_inventory.py`](../../backend/tests/test_inventory.py)
  cover quantities, containment, moves, removals, and carried weight.
- [`backend/tests/test_sheet_admin_item_augmentations.py`](../../backend/tests/test_sheet_admin_item_augmentations.py)
  covers item effect templates.
- [`backend/tests/test_sheet_runtime.py`](../../backend/tests/test_sheet_runtime.py)
  covers equipment, source items, grants, consumption, weapons, and rollback.
- Frontend item maker, proposal, equipment, quantity, and inventory display
  tests live under the item and sheet feature directories.

## Limitations

Equipment slots, hands, storage volume/item slots, and encumbrance penalties
are not implemented. Weight and storage capacity are authoritative data, but
consequences beyond rejecting invalid containment and authored formulas/effects
are not inferred.
