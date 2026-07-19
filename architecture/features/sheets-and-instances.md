# Sheets and Instances

## Purpose and model

The character system separates reusable authored templates from spawned,
session-specific characters and enemies. Templates live in `State.sheets` as
`Sheet` records. Spawned copies live in `State.instanced_sheets` as
`InstancedSheet` records keyed by instance ID and linked back through
`parent_id`.

[`backend/state/models/sheet.py`](../../backend/state/models/sheet.py) defines
both shapes. A template owns authored name/visibility, notes, XP metadata,
stats, resource-maximum formulas, resistances, attributes, action bridges,
proficiency bridges, and starting item bridges. An instance owns the copied
runtime versions of stats, formulas, resistances, attributes, actions,
proficiencies, and inventory plus current health, mana, notes, unassigned stat
points, permanent stat bonuses, and active augmentation bridges.

The current persisted model distinguishes player-facing versus GM-only
templates with `dm_only` rather than storing separate template classes.

## Template authoring

DM-only typed routes under
[`backend/features/sheet_admin/sheets/`](../../backend/features/sheet_admin/sheets/)
create, update, and delete templates. Create/update requests are complete
definitions: referenced actions, items, proficiencies, attributes, formulas,
and profiles are validated together before a mutation is committed.

Template action, item, and proficiency assignments use relationship bridges
instead of embedding definitions. Bridge IDs distinguish multiple
relationships and let item-granted behavior identify the exact inventory
source. Required baseline actions are enforced by
[`backend/state/default_actions.py`](../../backend/state/default_actions.py) so
templates cannot omit, duplicate, or remove system checks, Dodge, and Block.

The primary frontend workflow is
[`frontend/src/features/sheets/TemplateEditorForm.tsx`](../../frontend/src/features/sheets/TemplateEditorForm.tsx),
with the library and creation pages in the same feature directory. The editor
uses contextual creation dialogs for referenced definitions while final save
still submits one complete backend-validated template.

## Spawning and runtime ownership

`create_instanced_sheet` deep-copies template-owned runtime content. The
instance then evolves independently: later inventory, stat, proficiency,
attribute, resistance, and action edits do not rewrite the source template or
sibling instances. When values such as current HP, current mana, or
resistances are not supplied, the backend evaluates and copies valid defaults
from the template.

Encounter presets use the same pure instance builder for each requested copy,
so count-based encounter spawning has the same field-copy and resource-default
semantics without generating player access codes.

An instance can optionally receive a generated player access code as part of
DM creation. Access and claim behavior is documented in
[Authentication, sessions, and sheet access](../platform/authentication-sessions-and-sheet-access.md).

`create_sheet_from_instance` snapshots an evolved instance into a new
checkpoint template. It copies authored/evolved character structure but does
not copy runtime-only current health, current mana, unassigned points, active
augmentations/effects/conditions, or other transient application state.

## Runtime edits

DMs can edit spawned-sheet definitions and assignments through instance routes.
Players can edit only explicitly allowed fields on their assigned character,
including notes, current resources, allocated granted stat points, inventory
operations, equipment, and action execution. Entity IDs in a player request are
validated against the current session assignment.

Action pins are instance-owned `pinned_action_ids`, keyed by the available
action relationship (including an exact item-granted action relationship).
Players and DMs with access to that instance can set the ordered list. A state
mutation hook removes pins when an assigned action is deleted or an item action
is no longer available, so pins never authorize or resurrect inaccessible
actions.

The shared character display is implemented by
[`frontend/src/features/sheets/SheetViewerPage.tsx`](../../frontend/src/features/sheets/SheetViewerPage.tsx),
[`PlayerCharacterSheet.tsx`](../../frontend/src/features/sheets/PlayerCharacterSheet.tsx),
and focused sections under `components/`. GM and player views share
authoritative rendering while controls differ by role.

## Deletion and dependencies

A template cannot be deleted while spawned instances or encounter presets
depend on it. Deleting an instance removes its active conditions, standalone
effect applications, associated augmentations, player access codes, current XP
party membership, and the instance itself. Historical kill participant
snapshots remain intact because they record the participant identity at kill
time rather than depend on current party membership.

## Principal tests

- [`backend/tests/test_sheet_admin_sheets.py`](../../backend/tests/test_sheet_admin_sheets.py)
  covers complete authoring, spawning, defaults, snapshots, deletion, player
  edits, and dependency validation.
- Sheet bridge behavior is covered by the action, item, and proficiency bridge
  test modules under [`backend/tests/`](../../backend/tests/).
- Frontend builder, library, display, navigation, and section behavior is
  covered by tests under
  [`frontend/src/features/sheets/`](../../frontend/src/features/sheets/).

## Non-goals

Instances are character-sheet runtime copies, not map tokens. Token targeting,
initiative, turns, cross-sheet attack resolution, and automated combat remain
outside the current MVP.
