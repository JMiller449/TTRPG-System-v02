# Proficiencies

## Purpose and model

Proficiencies are reusable definitions linked to templates and instances with
per-character use counts and growth rates. They support campaign skills and
canonical weapon families while keeping progression on the spawned character
rather than the source template.

[`backend/state/models/proficiency.py`](../../backend/state/models/proficiency.py)
defines:

- `Proficiency`: ID, name, description, `custom` or `weapon_family` category,
  and the default growth rate used when an action first introduces it to a
  character.
- `ProficiencyBridge`: relationship ID, proficiency ID, use count, and growth
  rate.

The backend seeds the canonical weapon-family registry for long swords, short
swords, spears, shields, pugilists, staffs, bows, throwing, knives, and axes.
DMs may create additional custom definitions.

## Authoring and assignment

Definition CRUD is owned by
[`backend/features/sheet_admin/proficiencies/`](../../backend/features/sheet_admin/proficiencies/).
The authoring surface stores a nonnegative default growth-rate fraction; new
and migrated definitions default to `0.01`, meaning one percent per qualifying
use.
Template and instance bridge routes are owned by the sheet-admin sheets
feature. The backend rejects missing definitions, duplicate relationships,
negative use counts, invalid ID changes, and deletion while sheets, reference
Attributes, or action bindings still depend on a definition.

Spawning copies proficiency bridges to the instance. Later instance use gains
and DM edits affect only that character. Snapshotting an instance to a new
template captures its evolved proficiency bridges without modifying the
original parent.

## Action bindings and runtime growth

Formula expansion derives the current proficiency modifier from bridge growth
rate and use count, capped at the implemented maximum. Actions own an unlimited
list of proficiency bindings. A binding exposes
`action.resolved.proficiencies.<proficiency_id>.modifier` to formulas and stores
whether successful execution grows that proficiency. An explicit
`gain_proficiency_use` step can still add an authored amount to a named
proficiency.

Before formula evaluation, the backend checks every action binding against the
acting template or spawned instance. A missing growth-enabled proficiency is
added at zero uses with the definition's default growth rate, so its first
formula evaluation sees a zero modifier. A missing growth-disabled proficiency
also evaluates as zero but is not recorded on the character. After successful
evaluation, each binding with growth enabled gains one use. Existing bridges
and their rates are preserved. Attachment and growth are part of the action
transaction, so formula, mutation, or Roll20-delivery failure rolls both back.

Items do not own proficiency selection. A single item can grant separate
actions with different bindings, and one action can combine several
proficiencies. Equipping an item alone does not change the character's
proficiency bridges.

## Frontend

[`frontend/src/features/proficiencies/`](../../frontend/src/features/proficiencies/)
owns definition authoring. Template assignment and character display/editing
live in the sheets feature. Action authoring exposes definitions from the
authoritative registry, attaches a proficiency when its formula variable is
selected, and visibly rejects stale IDs. The binding toggle controls the
automatic one-use gain; an explicit `gain_proficiency_use` action step remains
an independent authored mutation.

Players see their assigned character's current capped percentage, use count,
and growth rate in a compact responsive card grid. A GM clicks a card to open a
focused assignment/progression editor. Add Existing opens the reusable
Proficiency catalog, while Create Proficiency opens the shared definition
editor and links the new definition only after its authoritative creation
response succeeds. Definition and manual bridge management remains DM-owned;
progression changes occur through action bindings or allowed backend action
steps, while the first qualifying action use may create missing zero-use
bridges automatically.

## Principal tests

- [`backend/tests/test_sheet_admin_proficiencies.py`](../../backend/tests/test_sheet_admin_proficiencies.py)
  covers definition CRUD, permissions, and dependencies.
- [`backend/tests/test_sheet_admin_proficiency_bridges.py`](../../backend/tests/test_sheet_admin_proficiency_bridges.py)
  and instance bridge tests cover assignments and validation.
- [`backend/tests/test_sheet_runtime.py`](../../backend/tests/test_sheet_runtime.py)
  covers multi-binding resolution, lazy attachment, growth toggles, and rollback.
- Frontend authoring and character proficiency tests live under the
  proficiency and sheet feature directories.

## Limitations

Mastery unlock enforcement and automatic hidden/disabled content remain later
roadmap work.
