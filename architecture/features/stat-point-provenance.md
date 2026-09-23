# Skill Point Provenance and Audit History

The user-facing Skill Point Provenance panel tracks the existing six core stat
points, not proficiencies or temporary stat modifiers. Rules remain governed by
[Leveling and Stat Points, §8](../../reference-docs/Chip_TTRPG_System.md#8-leveling-and-stat-points).

## Ownership and persistence

[`StatPointEntry`](../../backend/state/models/stat_points.py) records a global
sequence, UTC observation timestamp, historical character name and instance ID,
authenticated actor role and claimed instance ID, request identity, affected stat,
signed amount, before/after base and unspent values, per-source changes, and note.
There are no individual DM accounts in the existing shared-code authentication;
DM actions are attributed to the DM role, and players to their claimed instance.

The canonical `State.stat_point_history` registry is private and persisted without
pruning. Spawned core values are Starter / Spawned points already assigned to
stats. Explicit awards use Level-Up or Manual. Existing balances loaded without
history are intentionally treated as imported Starter points; no past dates,
allocation actors, or level-up awards are inferred. Schema v54 adds the registry,
and schema v55 reclassifies its legacy unknown baselines as Starter points. State
reconstruction initializes a missing baseline once. Global sequences preserve
audit order through sorted JSON exports.

[`stat_points/service.py`](../../backend/features/stat_points/service.py) compares
base stats and the unspent pool inside each state-sync mutation. This covers
spawning (including encounters), grants/removals, allocations, direct stat edits,
internal system mutations, and despawning. Records and values share the existing
checkpoint transaction, rollback, lock, and request deduplication boundary. Failed
and unchanged requests do not create point-change records.

History operations are excluded from undo inverses. The bounded runtime undo
stack retains the associated original point entries; undo appends their exact
source inverses as compensating entries. It never edits or deletes prior entries.
Despawning closes the current balances but preserves historical records; undo
restores their exact attribution. Records for despawned characters remain in DM
backup exports. Backup import intentionally restores the supplied campaign and
history as a whole, like the existing state-replacement contract.

## Sources and reconciliation

DM point requests accept optional `point_source` (`manual` or `level_up`, default
`manual`) and a bounded `reason`. Their route permissions remain authoritative.
Clicking a major stat opens an additive award dialog; its
`adjust_instanced_sheet_base_stat` intent carries a positive quantity rather than
a client-computed resulting total. The legacy absolute-set route remains a typed
administrative compatibility operation but is not exposed by this character UI.
The provenance panel's **Grant Unspent Points** action uses the parallel
`adjust_instanced_sheet_unassigned_stat_points` positive-delta intent. Its audit
entry has the explicit `unassigned_grant` kind, presented to the GM as “Gave
unassigned points.”
Core-stat level-up assignments preserve the existing health-max adjustment logic.
XP readiness and Level edits do not automatically grant points; §8.1 specifies
GM-assigned advancement and does not define a universal award amount.

Allocations transfer the attributed pool balance into the selected core stats.
For accounting, source selection uses Starting, Level-Up, Manual, then Legacy /
Unknown. Multi-stat allocation uses the displayed core-stat order. This convention
does not change point costs or gameplay. Removals use the same source order and
retain the removed points' original sources. Undo uses the original entries,
not a new source-selection guess. Negative authored base-stat corrections remain
visible as signed manual balances when necessary.

The backend projects cumulative positive and negative source totals, current
unspent/source balances, and current base values. Each core stat also projects an
assignment-origin pivot: Starter baseline, player allocation history net of
refunds, and the remaining direct DM assignments. Direct DM edits therefore do
not masquerade as player allocations. Base-stat reconciliation reads the private
direct-effect projection so active augmentations never become permanent points.

## Protocol and frontend

Snapshots and point-changing patches project `stat_point_summary` on instances.
Players receive only their claimed instance's summary. DMs also receive
`stat_point_audit`; the private history root and DM audit notes are excluded from
player snapshots, patches, and replay. These projections are generated contracts,
not persisted alternate state. Full history lives only in the private registry.

[`SheetStatPointHistory`](../../frontend/src/features/sheets/components/SheetStatPointHistory.tsx)
shows the source table, per-stat attribution, reconciliation explanation, and
filterable DM history in the character Stats destination. Existing
player allocation controls submit the same atomic allocation intent. Pending
requests reconcile to authoritative feedback and patches; the UI performs no
source accounting or gameplay calculation. The provenance summary and the
GM-only audit are always expanded across the dedicated page; the audit keeps
its own bounded scroll region for long histories.

Each major stat exposes the same Starter, User assigned, and DM assigned pivot on
hover or keyboard focus, followed by the active direct augmentations targeting
that stat. The displayed effective value and authoritative ledger base remain
visibly distinct.

## Validation

- [`test_stat_point_history.py`](../../backend/tests/test_stat_point_history.py)
  covers mixed-source grants, player attribution, exact undo, deduplication,
  migration, sorted export/import, retained despawn history, redaction/replay,
  permission failures, reconciliation, and checkpoint failure rollback.
- [`SheetStatPointHistory.test.tsx`](../../frontend/src/features/sheets/components/SheetStatPointHistory.test.tsx)
  covers player/DM rendering, metadata submission, pending/error behavior, and
  authoritative reconciliation.
- Existing stat, sheet, persistence, state-sync, and protocol tests remain the
  shared transaction and contract regression boundary.

The checkpoint and projected DM history grow with use; there is no separate
database or paginated audit endpoint. Future scope remains in
[the active plan](../../plan/active/PLAN.md).
