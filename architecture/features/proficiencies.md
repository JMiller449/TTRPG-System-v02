# Proficiencies

## Purpose and model

Proficiencies are reusable tagged definitions linked to templates and instances
with per-character use counts, base growth rates, and accumulated growth
points. They support campaign skills and canonical weapon families while
keeping progression on the spawned character rather than the source template.

[`backend/state/models/proficiency.py`](../../backend/state/models/proficiency.py)
defines:

- `Proficiency`: ID, name, description, `custom` or `weapon_family` category,
  managed tag IDs, and the default growth rate used when an action first
  introduces it to a character.
- `ProficiencyBridge`: relationship ID, proficiency ID, use count, base growth
  rate, and accumulated `growth_points` from `0.0` through `1.0`.

The backend seeds the canonical weapon-family registry for long swords, short
swords, spears, shields, pugilists, staffs, bows, throwing, knives, and axes.
DMs may create additional custom definitions.

## Authoring and assignment

Definition CRUD is owned by
[`backend/features/sheet_admin/proficiencies/`](../../backend/features/sheet_admin/proficiencies/).
The authoring surface stores registry-backed tags and a nonnegative default
growth-rate fraction; new and migrated definitions default to `0.01`, meaning
one percent per qualifying use. Canonical weapon families carry the `weapon`
tag, with sword and knife families also receiving their narrower seeded tags.
Template and instance bridge routes are owned by the sheet-admin sheets
feature. The backend rejects missing definitions, duplicate relationships,
negative use counts, invalid ID changes, and deletion while sheets, reference
Attributes, or action bindings still depend on a definition.

Spawning copies proficiency bridges to the instance. Later instance use gains
and DM edits affect only that character. Snapshotting an instance to a new
template captures its evolved proficiency bridges without modifying the
original parent.

## Action bindings and runtime growth

Formula expansion reads the bridge's accumulated growth points, capped at the
implemented maximum. Schema v56 initializes existing accumulated progress from
`min(1, growth_rate × use_count)` so upgrades preserve displayed proficiency.
Actions own an unlimited list of proficiency bindings. A binding exposes
`action.resolved.proficiencies.<proficiency_id>.modifier` to formulas and stores
whether successful execution grows that proficiency. An explicit
`gain_proficiency_use` step can still add an authored amount to a named
proficiency.

Before formula evaluation, the backend checks every action binding against the
acting template or spawned instance. A missing growth-enabled proficiency is
added at zero uses with the definition's default growth rate, so its first
formula evaluation sees a zero modifier. A missing growth-disabled proficiency
also evaluates as zero but is not recorded on the character. After successful
evaluation, each binding with growth enabled gains one use and adds its
effective per-use growth to accumulated points. Existing bridges and their base
rates are preserved. Attachment and growth are part of the action transaction,
so formula, mutation, or Roll20-delivery failure rolls both back.

`proficiency_growth_modifier` Effects temporarily transform the per-use rate
for definitions whose tags satisfy the Effect selector. All required tags must
match and any excluded tag prevents a match. Matching active standalone,
condition, and equipped-item Effects apply their normal ordered numeric
operations; stacks participate independently. The resulting rate must remain
finite and nonnegative, and awarded progress is capped at `1.0`. Removing the
Effect restores the base rate for later uses without removing points already
earned while it was active. Action bindings, explicit `gain_proficiency_use`
steps, and player-recorded uses share this calculation in
[`backend/features/proficiency_growth/service.py`](../../backend/features/proficiency_growth/service.py).

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
bridges automatically. Assigned players may also submit
`add_instanced_sheet_proficiency_uses` for an existing bridge on their own
character. The request accepts a positive quantity, increments `use_count`, and
awards the matching effective growth points through the normal authoritative
patch, request-deduplication, and audit flow.
Players cannot use it to set or reduce uses, change growth, manage assignments,
or target another instance. Each player character card exposes this append-only
operation through a compact integer field and Add Uses button; GM cards retain
the full correction editor.

## Principal tests

- [`backend/tests/test_sheet_admin_proficiencies.py`](../../backend/tests/test_sheet_admin_proficiencies.py)
  covers definition CRUD, permissions, and dependencies.
- [`backend/tests/test_sheet_admin_proficiency_bridges.py`](../../backend/tests/test_sheet_admin_proficiency_bridges.py)
  and instance bridge tests cover assignments and validation.
- [`backend/tests/test_sheet_runtime.py`](../../backend/tests/test_sheet_runtime.py)
  covers multi-binding resolution, lazy attachment, growth toggles, and rollback.
- [`backend/tests/test_proficiency_growth.py`](../../backend/tests/test_proficiency_growth.py)
  covers tag matching, temporary rate modification, and mastery capping.
- Frontend authoring and character proficiency tests live under the
  proficiency and sheet feature directories.
- Player-entered use tests cover quantity validation, assigned-instance
  authorization, generated contracts, request construction, and the quantity dialog.

## Limitations

Mastery unlock enforcement and automatic hidden/disabled content remain later
roadmap work.
