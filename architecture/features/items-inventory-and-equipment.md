# Items, Inventory, and Equipment

## Purpose and model

The item system separates reusable catalog definitions from per-character
inventory relationships. It supports equipment, consumables, ordinary carried
objects, storage containment, item-authored effects, granted actions, managed
tags, independent duplication, player-visible catalogs, and player item
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
equipment-owned augmentations by resolving every equipped, in-stock item's
canonical `effect_ids`, and removes them on unequip or depletion. Direct effects
are projected from a stable base so repeated synchronization does not
double-apply them.

Action grants are resolved through the exact source `ItemBridge`. Carried or
equipped availability is enforced at execution time. Quantity consumption is
part of the action transaction and occurs only after required Roll20 delivery
succeeds.

Items attach ordinary typed Attributes only when their granted actions or
effects need those values. Standard source-item Attributes include base damage,
governing stat, and reach. Weapon family/type and damage-type
classification are managed tags instead of bespoke fields. Items never
automatically receive action grants from a profile: the DM explicitly selects
shared action definitions, and creation validates that every source-item alias
used by a granted action refers to an Attribute attached to the item.

The Item Maker's guided weapon builder is the narrow exception to manual
multi-screen setup. Its explicit `create_weapon_with_actions` request atomically
creates one equippable Item with standard governing-stat/base-damage Attributes,
creates the selected ordinary Attack, Damage, and Parry Actions, and adds their
equipped grants. Each Action may choose its primary formula proficiency,
additional growth proficiencies, AP cost, and name. The builder does not infer
actions from tags or keep a live template relationship. Existing weapons use
normal Item editing plus ordinary Action authoring; failure in any generated
Action or Item validation rolls back the complete creation batch.

Proficiencies belong to granted actions rather than items. Equipping an item
does not add a proficiency bridge. Source-item formulas and `same_source_item`
effect selectors use the relationship ID to distinguish multiple copies of the
same definition.

## Tags and independent duplication

[`backend/state/models/tag.py`](../../backend/state/models/tag.py) defines the
shared `TagDefinition` registry used by items, formulas embedded in action
steps, reusable formulas, and augmentation tag selectors. Item payloads store
stable tag IDs. Tag folders remain presentation-only and carry no inherited
mechanics.

Items is divided into Catalog and Wizard. Catalog keeps the nested browser
beside the unrestricted Item editor, while Wizard owns coordinated guided
creation such as weapons with Actions. New, edit, and duplicate operations
remain in the Catalog workspace without an intermediate screen. Duplication
copies descriptive fields, tags, Attributes,
effect references, and action grants into a new unsaved Item definition. It
assigns a new Item ID and Attribute/action-row relationship IDs, defaults player
catalog availability to none, and chooses the first free case-insensitive
numeric name (`Name1`, `Name2`, and so on). Referenced Actions, Effects,
Proficiencies, Tags, and formulas remain shared intentionally.

Persisted schema version 57 promotes every legacy item-template definition to
an ordinary private Item, preserves its former template folder hierarchy under
an Items/Former Templates root, resolves ID/name collisions with numeric
suffixes, and clears the legacy registry. The old registry and request contract
remain temporarily available as a backward-compatibility boundary; current
authoring does not create template records.

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

Creating an Item from a folder's `+` menu queues normal entity creation followed
by a separate placement request; no folder ID enters the Item payload.

An assigned player may add one copy of an item allowed for their claimed
instance, edit the quantity of an item already in their own inventory, or
remove an eligible item. Quantity zero removes the entry, subject to the same
nonempty-container protection as explicit removal. The player quantity request
contains only the relationship ID and desired count; the backend resolves the
claimed instance, preserves the remaining bridge fields, and validates the
resulting inventory. The backend checks that stable instance ID for both
snapshot visibility and inventory-add requests. Item allow-lists are private and never sent to players. An
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
Equipment effects are selected from the shared Effect catalog. Item and item
template payloads store only stable `effect_ids`; effect payloads are authored
once in Effect Authoring. The backend validates source-item aliases against each
referring item and revalidates all consumers when a definition changes.
DMs and players can edit owned quantities and drag an unequipped item onto a valid storage card or the
root inventory drop zone. The location selector remains the keyboard and touch
fallback. The shared move route is available to authenticated players only for
their claimed player-sheet instance; DMs retain access to every instance.

## Principal tests

- [`backend/tests/test_sheet_admin_items.py`](../../backend/tests/test_sheet_admin_items.py)
  covers definition authoring, explicit Attributes/action grants, atomic weapon
  wizard generation and rollback, visibility, and proposals.
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
