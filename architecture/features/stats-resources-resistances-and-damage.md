# Stats, Resources, Resistances, and Damage

## Purpose and authority

The backend owns base stats, formula-backed derived stats, resource maxima,
current HP/mana, permanent allocation bonuses, resistance values, and damage
resolution. The frontend renders evaluated projections and submits edit or
damage intents; it does not reproduce the calculation rules.

## Stats and formulas

[`backend/state/models/stat.py`](../../backend/state/models/stat.py) defines six
core numeric stats and the supported derived formula-stat fields. Templates and
instances store formula definitions, while snapshots also project evaluated
numeric results. Formula evaluation and cycle/path validation are shared with
the formula runtime described in
[Formulas and variable registry](formulas-and-variable-registry.md).

`stat_bonuses` stores permanent bonuses applied directly to a derived substat.
`unassigned_stat_points` exists only on an instance. The DM grants the pool;
the assigned player can stage and atomically allocate points across the six core
stats. Substats are not allocation targets. The backend rejects unsupported
targets and overspending, and persists only the validated final allocation.
When an allocation or direct instance base-stat edit raises maximum HP, the
same increase is added to current HP and capped at
the new maximum, preserving the character's prior missing-health amount. For
example, 8/10 HP becomes 9/11.

Source attribution, explicit level-up awards, and historical audit for these
base stats and points are described in
[Skill point provenance and audit history](stat-point-provenance.md).

Snapshots and derived-state patches also project movement speed from evaluated
Dexterity using the active rules' threshold table. The greatest threshold met
determines the displayed feet of movement. Dexterity above 400 projects no
numeric speed, and the UI displays `GM discretion` as required by the rules.
Both GM and Player sheet overviews render this backend-owned value beside Dodge
Chance.

## Health and mana

Current health and mana are independent instance fields. Templates and
instances also carry authored `max_health` and `max_mana` formulas plus their
evaluated maxima. Backend mutations clamp current pools to authoritative bounds
after relevant changes. Mana is whole-numbered; invalid fractional mana writes
are rejected.

Player and DM resource routes support direct set and bounded adjustment on an
authorized instance. The frontend exposes full Health and Mana summary cards as
editor triggers and reconciles their values to subsequent patches.

## Action/reaction points and contribution points

Actions and reactions use one shared point pool. Each instance retains the
persisted `reactions` field and `evaluated_max_reactions` projection for
checkpoint and protocol compatibility, while the required **Action / Reaction
Points** Attribute derives the canonical maximum from the active Reaction Time
threshold table. The runtime retains two-decimal storage so legacy fractional
balances and customized formulas round-trip safely, but public adjustments add
or consume exactly one point. Both labeled consumption controls mutate the same
authoritative balance; reset remains explicit rather than turn-driven.

An assigned player can consume, restore, or reset the pool on their player
character. The GM can use the same controls for any spawned character from the
Characters workspace, including player characters and monsters. Players cannot
use the controls for monsters. Backend route authorization enforces instance
access and role ownership; frontend role checks are presentation only. Values
below zero or above the evaluated maximum are rejected, and a current value is
reclamped when its authored maximum changes.

Authored actions can include an explicit `adjust_action_points` step to consume
or restore a positive whole-number amount (default 1) from this same pool.
It uses the manual controls' bounds checks and participates in the complete
action transaction, including rollback when a later step or chat delivery fails.
Only spawned actors have a point pool; template-only execution is rejected.
See [Actions, execution, and history](actions-execution-and-history.md#action-point-steps).

`contribution_points` is a separate nonnegative whole-number character
balance, not an inventory item. DM-only set/add/subtract routes execute under
the state mutation lock and append `contribution_point_transactions` audit
records. Players see only their claimed character's balance; transaction
records and other characters' new runtime balance fields are redacted.

## Resistances and damage

[`backend/state/models/resistance.py`](../../backend/state/models/resistance.py)
stores general, physical/magical category, and canonical damage-type resistance
fractions. Authored values must be finite and within `0..1`. Runtime effective
resistance is also clamped to that range so active modifiers cannot create an
invalid multiplier.

[`backend/state/models/damage.py`](../../backend/state/models/damage.py) defines
canonical damage names and maps Slashing, Bludgeoning, and Piercing to physical;
the remaining supported types are magical. Damage resolution combines the
applicable resistance layers, applies the documented caps, floors once at the
final stage, and clamps resulting health at zero. The exact gameplay formula is
governed by the active rules and answered rulings, not this summary.

Damage enters through either an authored action `resolve_damage` step or the
typed `apply_instanced_sheet_damage` intent. Both use backend semantic damage
logic instead of exposing arbitrary health-path arithmetic to the frontend.

Each spawned instance also keeps a cumulative post-resistance damage total for
every canonical damage type. Both semantic damage paths increment the matching
counter in the same authoritative mutation that updates health, so failed or
rolled-back damage does not leave tracker drift. The counters are GM-private;
players can submit authorized typed damage but do not receive tracker values or
patches. A DM can reset one type at a time without changing health or resistance.

## Routes and UI

DM stat, formula-stat, resistance, point-grant, and allocation routes are in
[`backend/features/sheet_admin/stats/`](../../backend/features/sheet_admin/stats/).
Resource writes are in the sheet-admin sheets feature, while damage intake and
equipment interaction are in
[`backend/features/sheet_runtime/`](../../backend/features/sheet_runtime/).

Frontend stat, resource, resistance, and allocation sections live under
[`frontend/src/features/sheets/`](../../frontend/src/features/sheets/), notably
`SheetStatsSection`, `SheetResourceHeader`, `SheetResistancesEditor`, and
`SheetStatPointAllocator`. Overview keeps each derived formula attached to its
evaluated substat: hover or keyboard focus exposes the stored expression and
alias paths, while a GM click opens a modal editor for that substat alone.
Players receive the same read-only explanation without formula-edit controls.
In the GM instance-resistance view, each damage-type resistance control displays
its cumulative damage counter and a per-type reset action.

## Permissions

- DMs may edit template and instance stats/resistances and grant unassigned
  points, and may inspect or reset instance damage trackers.
- Assigned players may edit allowed current resources, allocate their granted
  points, and apply typed damage to their own instance.
- Players receive read-only evaluated stats, maxima, carried weight, and
  resistances for their assigned character. Damage trackers remain GM-only.
- Requests against another player's instance are rejected server-side.

## Principal tests

- [`backend/tests/test_sheet_admin_stats.py`](../../backend/tests/test_sheet_admin_stats.py)
  covers stat/formula/resistance validation and permissions.
- [`backend/tests/test_sheet_admin_sheets.py`](../../backend/tests/test_sheet_admin_sheets.py)
  covers resource limits and stat-point allocation.
- [`backend/tests/test_sheet_runtime.py`](../../backend/tests/test_sheet_runtime.py)
  covers semantic damage, resistance caps, healing, and resource action steps.
- Focused component/helper tests under
  [`frontend/src/features/sheets/`](../../frontend/src/features/sheets/) cover
  editing and allocation behavior.

## Non-goals

The current system does not resolve attacks against another sheet, automate
defense contests, or run turns. Point costs and restoration are explicit authored
action steps or manual sheet controls; reset remains a manual sheet control.
