from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from backend.core.transport import PatchOp
from backend.features.contribution_points.schema import (
    AdjustContributionPoints,
    SetContributionPoints,
)
from backend.features.state_sync.service import state_sync_service
from backend.state.models.contribution_points import ContributionPointTransaction
from backend.state.models.state import State


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate_player_instance(state: State, instance_id: str) -> None:
    instance = state.instanced_sheets.get(instance_id)
    template = state.sheets.get(instance.parent_id) if instance is not None else None
    if instance is None or template is None or template.dm_only:
        raise ValueError("Contribution points can only be managed for player characters.")


def _record(
    state: State,
    *,
    instance_id: str,
    amount: int,
    balance_after: int,
    reason: str,
) -> PatchOp:
    transaction = ContributionPointTransaction(
        id=f"contribution_{uuid4()}",
        instance_id=instance_id,
        amount=amount,
        balance_after=balance_after,
        reason=reason.strip(),
        occurred_at=_now(),
    )
    return state_sync_service.add_mutation(
        state,
        state_sync_service.join_path("contribution_point_transactions", transaction.id),
        transaction,
    )


async def set_contribution_points(request: SetContributionPoints) -> None:
    def mutation(state: State) -> tuple[None, list[PatchOp]]:
        _validate_player_instance(state, request.instance_id)
        instance = state.instanced_sheets[request.instance_id]
        previous = instance.contribution_points
        path = state_sync_service.join_path(
            "instanced_sheets", request.instance_id, "contribution_points"
        )
        if previous == request.value:
            return None, []
        return None, [
            state_sync_service.set_mutation(state, path, request.value),
            _record(
                state,
                instance_id=request.instance_id,
                amount=request.value - previous,
                balance_after=request.value,
                reason=request.reason or "Set balance",
            ),
        ]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def adjust_contribution_points(request: AdjustContributionPoints) -> None:
    def mutation(state: State) -> tuple[None, list[PatchOp]]:
        _validate_player_instance(state, request.instance_id)
        instance = state.instanced_sheets[request.instance_id]
        next_value = instance.contribution_points + request.delta
        if next_value < 0:
            raise ValueError("Contribution points cannot fall below zero.")
        if request.delta == 0:
            return None, []
        path = state_sync_service.join_path(
            "instanced_sheets", request.instance_id, "contribution_points"
        )
        return None, [
            state_sync_service.set_mutation(state, path, next_value),
            _record(
                state,
                instance_id=request.instance_id,
                amount=request.delta,
                balance_after=next_value,
                reason=request.reason or "Balance adjustment",
            ),
        ]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
