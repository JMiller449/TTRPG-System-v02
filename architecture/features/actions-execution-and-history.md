# Actions, Execution, and History

## Purpose and model

Actions are backend-authored command pipelines representing checks, spells,
weapon use, item use, resource costs, healing, damage, conditions, effects, and
proficiency growth. They replace hardcoded feature-specific roll buttons with a
validated sequence of reusable steps.

[`backend/state/models/action.py`](../../backend/state/models/action.py) defines
an action's ID, name, roll-mode kind, notes, attributes, and ordered steps.
Supported steps include:

- calculate a reusable execution-scoped value;
- compose and send a Roll20 message;
- compose and send a structured Roll20 roll card;
- bounded set, increment, or decrement of an allowed numeric path;
- semantic typed damage;
- proficiency-use gain;
- application/removal of an augmentation;
- application/removal of a condition preset.

Step formulas may be inline, reference a global formula, or consume a value
calculated earlier in the same execution.

Each Roll20 message or roll step also owns an explicit `public` or `gm` visibility.
Existing and newly migrated steps default to `public`; the backend, rather than
the browser UI, applies the selected destination to the finalized message.

Structured `send_roll` steps separate a card title and one or two labeled
formula results from Roll20 command syntax. They select `simple`, `damage`, or
portable `default` presentation. The backend expands formulas, applies matching
formula modifiers and action roll modes, derives the actor name from the
authoritative sheet, sanitizes template field text, and emits native Roll20
template syntax. `simple` and `damage` use the active D&D 5e sheet templates;
`default` is the campaign-independent fallback.

## Authoring and assignment

DM-only CRUD in
[`backend/features/sheet_admin/actions/`](../../backend/features/sheet_admin/actions/)
validates step shapes, variable paths, aliases, references, bounds, attributes,
and roll-mode compatibility. Mutation paths come from backend authoring
metadata, not raw arbitrary state paths.

Actions are assigned to templates or instances through relationship bridges.
Items may also grant actions while carried or equipped and may consume a
configured quantity on successful execution. Required baseline actions are
seeded and enforced for every template.

Baseline stat checks, Dodge, Block, canonical weapon rolls, and spell presets
use structured roll cards. Free-form `send_message` remains available for
emotes, narrative output, and advanced Roll20 commands.

The frontend authoring surface is
[`frontend/src/features/actions/`](../../frontend/src/features/actions/). The
character action surface resolves direct assignments and eligible item grants
into the same `perform_action` intent.

Action create/update requests remain in the editor as correlated pending saves.
The draft is retained if the server rejects the request. On success, the editor
reconciles to and selects the authoritative action returned through state sync,
then shows an inline confirmation; it does not clear to a new invalid draft.

## Execution transaction

[`backend/features/sheet_runtime/service.py`](../../backend/features/sheet_runtime/service.py)
resolves the acting sheet/instance, verifies player assignment or DM authority,
resolves an unambiguous source item when required, validates action assignment,
and evaluates steps in order against an isolated working state.

Calculated values are scoped to one execution and evaluated once. Mutations are
collected against the working state. Roll20 messages are sent to the acting
user's binding and require correlated delivery acknowledgement. Only after all
required deliveries succeed are the authoritative mutations committed through
state sync and persisted.

A delivery failure, timeout, disconnect, or bridge replacement rejects the
action and discards backend mutations. Roll20 cannot provide a deletion
transaction: in a multi-message action, an early message may already be visible
if a later message fails.

Players may execute only actions assigned to their claimed instance or granted
by eligible owned items. DMs may administratively execute an unassigned action
for a selected character. Cross-sheet targets and automated attack resolution
are rejected in the current MVP.

## Roll modes and output

Check actions support normal, advantage, and disadvantage. Damage actions
support normal and critical. Runtime composition applies only modes compatible
with the action and eligible roll expression. Messages include command/sheet
context and mode labels for the Roll20 table log.

For free-form messages, after formula expansion and roll-mode transformation,
`/r` and `/roll` output
is normalized to Roll20 inline-roll syntax. A `gm` message is then sent as a
`/w gm` whisper, which supports both ordinary text and embedded `[[dice]]`
expressions. Existing explicit `/w gm` and `/gmroll` commands are not
double-wrapped.

Structured rolls place transformed expressions directly inside Roll20
`[[...]]` template fields and prefix GM cards with `/w gm`. Check modes replace
the eligible `1d100`; critical mode doubles each damage expression. The card
title records the applied mode once.

## Action history

Successful action execution records a bounded backend-owned
`ActionHistoryEntry` with request/action identity, actor and target context,
state version, status/summary, emitted messages, mutation summaries, formula
summaries, and safe errors when present. History is persisted and distributed
through snapshots/patches, but it is an audit/status stream rather than a second
authoritative dice log.

Entry construction and bounded storage behavior live in
[`backend/features/action_history/`](../../backend/features/action_history/).
Public Roll20 messages are public history text; GM-directed messages are stored
as `gm_only` history text and are removed from player projections.

DMs can view global actor-labelled history. Character views filter to the
selected sheet/instance. Player history is redacted to assigned-character-safe
content. History insertion is intentionally non-undoable so DM undo does not
erase the record of the action that produced the reverted mutation.

## Principal tests

- [`backend/tests/test_sheet_admin_actions.py`](../../backend/tests/test_sheet_admin_actions.py)
  covers authoring validation and dependencies.
- [`backend/tests/test_sheet_runtime.py`](../../backend/tests/test_sheet_runtime.py)
  covers execution, formulas, modes, mutations, damage, items, effects,
  permissions, delivery acknowledgement, and rollback.
- [`backend/tests/test_action_history.py`](../../backend/tests/test_action_history.py)
  covers bounded storage and redaction.
- Frontend action authoring, quick action, roll-mode, and history tests live
  under [`frontend/src/features/actions/`](../../frontend/src/features/actions/),
  [`frontend/src/features/rolls/`](../../frontend/src/features/rolls/), and the
  sheets feature.

## Non-goals

Roll20 remains the play log. The app does not target tokens, resolve opposed
defenses, retract delivered chat, or automate turns/rounds.
