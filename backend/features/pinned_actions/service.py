from __future__ import annotations

from backend.core.transport import PatchOp
from backend.features.pinned_actions.schema import SetPinnedInstanceActions
from backend.features.state_sync.service import state_sync_service
from backend.state.models.sheet import InstancedSheet
from backend.state.models.state import State


def available_action_relationship_ids(state: State, instance: InstancedSheet) -> set[str]:
    available = {
        bridge.relationship_id
        for bridge in instance.actions.values()
        if bridge.entry_id in state.actions
    }
    for item_bridge in instance.items.values():
        if item_bridge.count <= 0:
            continue
        item = state.items.get(item_bridge.item_id)
        if item is None:
            continue
        for grant in item.action_grants:
            if grant.action_id not in state.actions:
                continue
            if grant.availability == "equipped" and not item_bridge.equipped:
                continue
            if grant.consume_quantity > item_bridge.count:
                continue
            available.add(f"item:{item_bridge.relationship_id}:{grant.action_id}")
    return available


def synchronize_pinned_actions_mutation(state: State) -> list[PatchOp]:
    ops: list[PatchOp] = []
    for instance_id, instance in state.instanced_sheets.items():
        available = available_action_relationship_ids(state, instance)
        cleaned = [action_id for action_id in instance.pinned_action_ids if action_id in available]
        if cleaned != instance.pinned_action_ids:
            ops.append(
                state_sync_service.set_mutation(
                    state,
                    state_sync_service.join_path(
                        "instanced_sheets", instance_id, "pinned_action_ids"
                    ),
                    cleaned,
                )
            )
    return ops


async def set_pinned_instance_actions(request: SetPinnedInstanceActions) -> None:
    def mutation(state: State) -> tuple[None, list[PatchOp]]:
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")
        if len(request.action_relationship_ids) != len(set(request.action_relationship_ids)):
            raise ValueError("An action can only be pinned once.")
        available = available_action_relationship_ids(state, instance)
        invalid = [
            action_id for action_id in request.action_relationship_ids if action_id not in available
        ]
        if invalid:
            raise ValueError("Only currently available actions can be pinned.")
        path = state_sync_service.join_path(
            "instanced_sheets", request.instance_id, "pinned_action_ids"
        )
        return None, [state_sync_service.set_mutation(state, path, request.action_relationship_ids)]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)
