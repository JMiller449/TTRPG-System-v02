# Items, Inventory, and Equipment

## Purpose and model

The item system separates reusable catalog definitions from per-character
inventory relationships. It supports equipment, consumables, ordinary carried
objects, storage containment, item-authored effects, granted actions, weapon
profiles, player-visible catalogs, and player item proposals.

[`backend/state/models/item.py`](../../backend/state/models/item.py) defines:

- `Item`: authored identity, interaction type, descriptive/GM fields, price,
  numeric weight, publication/approval state, storage behavior, optional weapon
  profile, attributes, action grants, and augmentation templates.
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
invalid relationships. Nonempty containers cannot be removed until their
contents are moved.

Carried weight is a backend-derived projection. It multiplies definition
weight by quantity, includes equipped items, traverses containment, and honors
containers configured to ignore contained weight. Item weights must be finite
nonnegative numeric pounds. The evaluated total is sent in snapshots and
patches; the frontend only formats it.

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

Weapon-profile items require canonical weapon attributes. They automatically
grant the canonical weapon actions and add a missing matching instance
proficiency on equip. Source-item formulas and `same_source_item` effect
selectors use the relationship ID to distinguish multiple copies of the same
definition.

## Catalog visibility and player proposals

DMs author definitions through
[`backend/features/sheet_admin/items/`](../../backend/features/sheet_admin/items/)
and [`frontend/src/features/items/ItemMakerPage.tsx`](../../frontend/src/features/items/ItemMakerPage.tsx).
They can publish or hide an approved definition from the player catalog.

An assigned player may add one copy of a published item or remove an eligible
item from their own inventory. A hidden definition is normally redacted, but it
remains visible when needed to render an item the assigned character already
owns.

Players may propose non-mechanical equippable or inventory-only items. Pending
proposals are visible only to the submitting character and DM. Approval
atomically publishes the definition and grants one copy to the submitter;
denial removes it. Players cannot propose effects, mechanical attributes,
action grants, consumable behavior, or other DM-owned mechanics.

## Frontend inventory

Character inventory/equipment presentation is implemented under
[`frontend/src/features/sheets/`](../../frontend/src/features/sheets/), while
definition authoring and the proposal form are under
[`frontend/src/features/items/`](../../frontend/src/features/items/). Local
helpers calculate display groupings and labels only; quantities, containment,
weight, equipment eligibility, and action availability remain backend-owned.

## Principal tests

- [`backend/tests/test_sheet_admin_items.py`](../../backend/tests/test_sheet_admin_items.py)
  covers definition authoring, profiles, visibility, and proposals.
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

Equipment capacity, slots, hands, encumbrance penalties, and automatic
container capacity are not implemented. Carried weight is authoritative data,
but consequences beyond authored formulas/effects are not inferred.
