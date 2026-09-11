from __future__ import annotations

from dataclasses import asdict, replace
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, cast
from uuid import uuid4

from backend.core.request_context import current_request_source
from backend.core.transport import PatchOp
from backend.state.models.stat_points import (
    CORE_STATS, LOCATIONS, POINT_SOURCES, PointSource, StatPointEntry, StatPointSummary,
)

if TYPE_CHECKING:
    from backend.state.models.state import State


def values_for(instance: Any, template: Any = None) -> dict[str, int]:
    stats = instance.stats or (template.stats if template else None)
    return {"unspent": instance.unassigned_stat_points,
            **{key: getattr(stats, key, 0) for key in CORE_STATS}}


def baseline_entries(instance_id: str, name: str, values: dict[str, int],
                     source: PointSource = "legacy_unknown") -> list[StatPointEntry]:
    now = datetime.now(timezone.utc).isoformat()
    return [StatPointEntry(
        id=str(uuid4()), instance_id=instance_id, character_name=name,
        occurred_at=now, actor_role="system", actor_instance_id=None,
        request_id=None, request_type="baseline", kind="baseline", skill=key if key != "unspent" else None,
        amount=value, previous_value=0, resulting_value=value,
        previous_unspent=0, resulting_unspent=values["unspent"],
        changes={key: {source: value}},
        reason="Existing balance observed; original sources and dates are unknown.",
    ) for key, value in values.items()]


def initialize_legacy_baselines(state: State) -> None:
    known = {entry.instance_id for entry in state.stat_point_history.values()}
    for instance_id, instance in state.instanced_sheets.items():
        if instance_id in known:
            continue
        template = state.sheets.get(instance.parent_id)
        for entry in baseline_entries(instance_id, template.name if template else instance_id,
                                      values_for(instance, template)):
            state.stat_point_history[entry.id] = replace(entry, sequence=_next_sequence(state))


def _next_sequence(state: State) -> int:
    return max((e.sequence for e in state.stat_point_history.values()), default=0) + 1


def _entries(state: State, instance_id: str) -> list[StatPointEntry]:
    return sorted((e for e in state.stat_point_history.values() if e.instance_id == instance_id),
                  key=lambda e: (e.sequence, e.occurred_at, e.id))


def _balances(entries: list[StatPointEntry]) -> dict[str, dict[PointSource, int]]:
    balances = {key: {source: 0 for source in POINT_SOURCES} for key in LOCATIONS}
    for entry in entries:
        for key, changes in entry.changes.items():
            for source, amount in changes.items():
                balances[key][source] += amount
    return balances


def project(state: State, instance_id: str) -> tuple[StatPointSummary, list[StatPointEntry]]:
    instance = state.instanced_sheets[instance_id]
    template = state.sheets.get(instance.parent_id)
    values = values_for(instance, template)
    entries = _entries(state, instance_id)
    # Supports in-memory fixture/seed construction before its first mutation.
    if not entries:
        entries = baseline_entries(instance_id, template.name if template else instance_id, values)
    balances = _balances(entries)
    earned = {s: 0 for s in POINT_SOURCES}
    removed = {s: 0 for s in POINT_SOURCES}
    player_allocations = {key: 0 for key in CORE_STATS}
    for entry in entries:
        for source in POINT_SOURCES:
            net = sum(changes.get(source, 0) for changes in entry.changes.values())
            if entry.kind == "undo" and net > 0:
                # Restoring removed points does not earn the same grant twice.
                removed[source] -= net
            else:
                earned[source] += max(0, net)
                removed[source] += max(0, -net)
        if entry.player_allocation and entry.kind in {"allocation", "refund"} and entry.skill:
            player_allocations[entry.skill] += entry.amount
    return StatPointSummary(
        earned=earned, removed=removed, unspent=values["unspent"],
        allocated={key: values[key] for key in CORE_STATS},
        allocation_sources={key: balances[key] for key in CORE_STATS},
        unspent_sources=balances["unspent"], player_allocations=player_allocations,
        reconciles=all(sum(balances[key].values()) == values[key] for key in LOCATIONS),
        has_legacy_baseline=any("legacy_unknown" in changes for e in entries for changes in e.changes.values()),
    ), entries


def _take(balances: dict[PointSource, int], amount: int) -> dict[PointSource, int]:
    """Accounting convention: starting, level-up, manual, then unknown points."""
    result: dict[PointSource, int] = {}
    for source in POINT_SOURCES:
        taken = min(max(0, balances[source]), amount)
        if taken:
            result[source] = taken
            amount -= taken
    if amount:
        # Authored core stats may be negative; preserve that correction visibly.
        result["manual"] = result.get("manual", 0) + amount
    return result


def audit_mutation(state: State, previous: State) -> list[PatchOp]:
    """Append after undo inverses are built, inside the same persistence transaction."""
    from backend.features.state_sync.service import state_sync_service as sync

    if any(state.stat_point_history.get(key) != entry
           for key, entry in previous.stat_point_history.items()):
        raise ValueError("Stat point history is append-only.")

    context = current_request_source()
    role = context.actor_role if context else "system"
    request_type = context.request_type if context else "system"
    source = cast(PointSource, context.point_source if context else "manual")
    ops: list[PatchOp] = []
    for instance_id in sorted(set(previous.instanced_sheets) | set(state.instanced_sheets)):
        old = previous.instanced_sheets.get(instance_id)
        new = state.instanced_sheets.get(instance_id)
        instance = new or old
        template = state.sheets.get(instance.parent_id) or previous.sheets.get(instance.parent_id)
        before = values_for(old, template) if old else dict.fromkeys(LOCATIONS, 0)
        after = values_for(new, template) if new else dict.fromkeys(LOCATIONS, 0)
        if old and new and before == after:
            continue
        entries = _entries(state, instance_id)
        if old and not entries:
            for entry in baseline_entries(instance_id, template.name if template else instance_id, before):
                entry = replace(entry, sequence=_next_sequence(state))
                ops.append(sync.add_mutation(state, sync.join_path("stat_point_history", entry.id), entry))
                entries.append(entry)
        balances = _balances(entries)
        pool_delta = after["unspent"] - before["unspent"]
        stat_deltas = {key: after[key] - before[key] for key in CORE_STATS}
        transfer = (request_type == "allocate_instanced_sheet_stat_points") and pool_delta != 0 and (
            sum(stat_deltas.values()) == -pool_delta and
            all(delta * pool_delta <= 0 for delta in stat_deltas.values())
        )
        pool = before["unspent"]
        for key in LOCATIONS:
            delta = after[key] - before[key]
            if key == "unspent" and transfer:
                continue
            if not delta and (old is not None or key != "unspent"):
                continue
            entry_source: PointSource = "starting" if old is None else source
            kind = "spawn" if old is None else "removal" if new is None else "adjustment"
            changes: dict[str, dict[PointSource, int]]
            previous_pool = pool
            if transfer:
                kind = "allocation" if delta > 0 else "refund"
                selected = _take(balances["unspent" if delta > 0 else key], abs(delta))
                changes = {key: {s: n if delta > 0 else -n for s, n in selected.items()},
                           "unspent": {s: -n if delta > 0 else n for s, n in selected.items()}}
                pool -= delta
            else:
                changes = {key: {entry_source: delta} if delta >= 0 else
                           {s: -n for s, n in _take(balances[key], -delta).items()}}
                if key == "unspent":
                    pool += delta
            entry = StatPointEntry(
                id=str(uuid4()), instance_id=instance_id,
                character_name=template.name if template else instance_id,
                occurred_at=datetime.now(timezone.utc).isoformat(), actor_role=role,
                actor_instance_id=context.actor_instance_id if context else None,
                request_id=context.request_id if context else None, request_type=request_type,
                kind=kind, skill=key if key != "unspent" else None, amount=delta,
                previous_value=before[key], resulting_value=after[key],
                previous_unspent=previous_pool, resulting_unspent=pool, changes=changes,
                reason=context.point_reason if context else "",
                sequence=_next_sequence(state),
                player_allocation=kind == "allocation" and role == "player",
            )
            ops.append(sync.add_mutation(state, sync.join_path("stat_point_history", entry.id), entry))
            for location, parts in changes.items():
                for part_source, amount in parts.items():
                    balances[location][part_source] += amount
        if new:
            summary, history = project(state, instance_id)
            ops.extend([
                PatchOp(op="set", path=sync.join_path("instanced_sheets", instance_id, "stat_point_summary"), value=asdict(summary)),
                PatchOp(op="set", path=sync.join_path("instanced_sheets", instance_id, "stat_point_audit"), value=[asdict(e) for e in history]),
            ])
    return ops


def audit_undo(state: State, originals: list[StatPointEntry]) -> list[PatchOp]:
    from backend.features.state_sync.service import state_sync_service as sync

    context = current_request_source()
    ops: list[PatchOp] = []
    for original in reversed(originals):
        entry = StatPointEntry(
            id=str(uuid4()), instance_id=original.instance_id,
            character_name=original.character_name,
            occurred_at=datetime.now(timezone.utc).isoformat(),
            actor_role=context.actor_role if context else "system",
            actor_instance_id=context.actor_instance_id if context else None,
            request_id=context.request_id if context else None,
            request_type="undo_last_state_change",
            kind="refund" if original.kind == "allocation" else "undo",
            skill=original.skill, amount=-original.amount,
            previous_value=original.resulting_value, resulting_value=original.previous_value,
            previous_unspent=original.resulting_unspent, resulting_unspent=original.previous_unspent,
            changes={key: {source: -amount for source, amount in parts.items()}
                     for key, parts in original.changes.items()},
            reason=f"Undo of {original.id}",
            sequence=_next_sequence(state),
            player_allocation=original.player_allocation,
        )
        ops.append(sync.add_mutation(state, sync.join_path("stat_point_history", entry.id), entry))
    for instance_id in sorted({entry.instance_id for entry in originals}):
        if instance_id in state.instanced_sheets:
            summary, history = project(state, instance_id)
            ops.extend([
                PatchOp(op="set", path=sync.join_path("instanced_sheets", instance_id, "stat_point_summary"), value=asdict(summary)),
                PatchOp(op="set", path=sync.join_path("instanced_sheets", instance_id, "stat_point_audit"), value=[asdict(e) for e in history]),
            ])
    return ops
