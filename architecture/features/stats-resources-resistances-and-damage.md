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
the assigned player can stage and atomically allocate points across core stats
or supported substats. The backend rejects overspending and persists only the
validated final allocation.

## Health and mana

Current health and mana are independent instance fields. Templates and
instances also carry authored `max_health` and `max_mana` formulas plus their
evaluated maxima. Backend mutations clamp current pools to authoritative bounds
after relevant changes. Mana is whole-numbered; invalid fractional mana writes
are rejected.

Player and DM resource routes support direct set and bounded adjustment on an
authorized instance. The frontend exposes full Health and Mana summary cards as
editor triggers and reconciles their values to subsequent patches.

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

## Routes and UI

DM stat, formula-stat, resistance, point-grant, and allocation routes are in
[`backend/features/sheet_admin/stats/`](../../backend/features/sheet_admin/stats/).
Resource writes are in the sheet-admin sheets feature, while damage intake and
equipment interaction are in
[`backend/features/sheet_runtime/`](../../backend/features/sheet_runtime/).

Frontend stat, resource, resistance, and allocation sections live under
[`frontend/src/features/sheets/`](../../frontend/src/features/sheets/), notably
`SheetStatsSection`, `SheetResourceHeader`, `SheetResistancesEditor`, and
`SheetStatPointAllocator`.

## Permissions

- DMs may edit template and instance stats/resistances and grant unassigned
  points.
- Assigned players may edit allowed current resources, allocate their granted
  points, and apply typed damage to their own instance.
- Players receive read-only evaluated stats, maxima, carried weight, and
  resistances for their assigned character.
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
defense contests, spend reactions, or run turns. It records and evaluates
character-sheet values used by authored actions.
