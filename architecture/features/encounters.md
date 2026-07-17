# Encounters

## Purpose and model

Encounter presets are DM-authored groups of enemy templates used to spawn a
repeatable set of enemy sheet instances. They are setup conveniences, not an
active combat, initiative, or turn tracker.

[`backend/state/models/encounter.py`](../../backend/state/models/encounter.py)
defines an `EncounterPreset` with ID, name, update timestamp, and ordered
entries. Each entry references one template ID and a positive spawn count.
Presets live in the top-level `encounter_presets` state collection.

## Authoring and validation

DM-only routes in
[`backend/features/encounters/`](../../backend/features/encounters/) save,
delete, and spawn presets. Save validates IDs, counts, and referenced templates.
The backend currently requires referenced templates to exist but does not
enforce that they are GM-only enemy definitions. Template deletion is prevented
while a preset still references it.

Saving is an upsert of the complete preset. Deleting removes only the preset;
it does not despawn instances created by prior uses.

## Spawning

Spawning resolves every entry against current templates, allocates unique
instance IDs, and creates the requested number of independent instances through
the same pure instance builder used by `create_instanced_sheet`. Each instance
receives an independent deep copy of template stats, inventory, proficiencies,
actions, attributes, resistances, maximum-resource formulas, racial HP
multiplier, and stat bonuses. Starting health and mana use the canonical
maximum-resource evaluation.

Encounter spawning does not generate player access codes. The resulting
records are otherwise ordinary spawned sheets and can be edited, assigned, or
deleted through character administration.

The spawn operation is committed through state sync so all created instances
arrive in one authoritative update rather than through frontend-local copies.

## Frontend

[`frontend/src/features/encounters/EncounterPanel.tsx`](../../frontend/src/features/encounters/EncounterPanel.tsx)
and its components provide preset editing, template selection, entry counts,
deletion, and spawn actions. The frontend draft is local until saved. Current
presets and spawned sheets reconcile from state snapshots/patches.

Encounter access is DM-only. Enemy templates and instances are redacted from
players according to normal sheet visibility.

## Principal tests

- [`backend/tests/test_encounters.py`](../../backend/tests/test_encounters.py)
  covers CRUD, validation, count-based spawning, canonical construction parity,
  independent copies, and permissions.
- [`backend/tests/test_sheet_admin_sheets.py`](../../backend/tests/test_sheet_admin_sheets.py)
  covers template deletion dependencies and instance initialization.
- Frontend encounter draft/request behavior is covered under
  [`frontend/src/features/encounters/`](../../frontend/src/features/encounters/).

## Non-goals

There is no persisted “active encounter” state, initiative order, rounds,
turns, targeting, or automatic cleanup of spawned enemies. Combat/turn tracking
is a later roadmap item.
