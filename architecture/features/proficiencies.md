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
negative use counts, invalid ID changes, and deletion while sheets, items,
attributes, or actions still depend on a definition.

Spawning copies proficiency bridges to the instance. Later instance use gains
and DM edits affect only that character. Snapshotting an instance to a new
template captures its evolved proficiency bridges without modifying the
original parent.

## Runtime growth and weapons

Formula expansion derives the current proficiency multiplier from bridge growth
rate and use count, capped at the implemented maximum. An authored
`gain_proficiency_use` action step can increment a named proficiency or resolve
the selected weapon's Proficiency Attribute. Canonical weapon presets use the
weapon reference so their qualifying use gains the same proficiency used in the
roll.

When any action with a valid Action Proficiency Attribute is executed, the
backend checks the acting template or spawned instance before formula
evaluation. If that character does not yet have the referenced proficiency, it
creates one bridge with zero uses and the definition's default growth rate. The
first roll therefore uses a zero modifier. After all authored steps evaluate,
the backend automatically increments the action proficiency once. Existing
bridges and their rates are preserved. Attachment and use gain are part of the
action transaction, so formula, mutation, or Roll20-delivery failure rolls both
back.

Weapon-profile items reference a weapon-family proficiency through required
item attributes. Equipping a weapon automatically adds the matching instance
proficiency bridge when missing so canonical weapon actions can resolve
`weapon_proficiency`. This does not add the bridge to the template or siblings.

## Frontend

[`frontend/src/features/proficiencies/`](../../frontend/src/features/proficiencies/)
owns definition authoring. Template assignment and character display/editing
live in the sheets feature. Item authoring selects proficiency definitions from
the authoritative registry and visibly rejects stale IDs rather than retaining
free-text references.

Players see their assigned character's current capped percentage, use count,
and growth rate. Definition and
manual bridge management remains DM-owned; progression changes occur through
allowed backend action steps, while the first qualifying action use may create
the missing zero-use bridge automatically.

## Principal tests

- [`backend/tests/test_sheet_admin_proficiencies.py`](../../backend/tests/test_sheet_admin_proficiencies.py)
  covers definition CRUD, permissions, and dependencies.
- [`backend/tests/test_sheet_admin_proficiency_bridges.py`](../../backend/tests/test_sheet_admin_proficiency_bridges.py)
  and instance bridge tests cover assignments and validation.
- [`backend/tests/test_sheet_runtime.py`](../../backend/tests/test_sheet_runtime.py)
  covers use gain and weapon resolution.
- Frontend authoring and character proficiency tests live under the
  proficiency and sheet feature directories.

## Limitations

Mastery unlock enforcement and automatic hidden/disabled content remain later
roadmap work. Proficiency use grows only when an explicit backend-authored step
or DM operation changes it.
