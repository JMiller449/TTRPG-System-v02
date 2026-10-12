from copy import deepcopy
from dataclasses import asdict
from hashlib import sha256
import json
from math import floor, isfinite
from uuid import uuid4
from backend.core.transport import PatchOp
from backend.features.session.models import SessionRole
from backend.features.sheet_runtime.schema import ActionExecuted

from backend.features.sheet_runtime import service as runtime
from backend.features.sheet_runtime.schema import PerformAction
from backend.features.state_sync.service import state_sync_service as sync
from backend.state.models.action import (
    CalculateValueStep, DecrementValueStep, IncrementValueStep, ResolveDamageStep,
    SendMessageStep, SendRollStep, SetValueStep,
)
from backend.state.models.sigil import Sigil, SigilCharge, SigilNode
from backend.state.models.state import State
from backend.state.store import StateSingleton
from .schema import (ActivateSigil, DeleteSigil, DischargeSigil, DuplicateSigil, ImbueSigil, PreviewSigil, SaveSigil, SetSigilAuthoringAccess, SigilPreview)


def ensure_authoring(state: State, role: SessionRole, assigned: str | None) -> None:
    if role == "dm":
        return
    instance = state.instanced_sheets.get(assigned)
    if role != "player" or instance is None or not instance.can_inscribe_sigils:
        raise PermissionError("The GM has not enabled sigil creation for your character.")


async def set_authoring_access(request: SetSigilAuthoringAccess, role: SessionRole) -> None:
    if role != "dm":
        raise PermissionError("Only the GM can select players for sigil creation.")

    def mutation(state: State) -> tuple[None, list[PatchOp]]:
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError("Character instance does not exist.")
        parent = state.sheets.get(instance.parent_id)
        if parent is None or parent.dm_only:
            raise ValueError("Select a player character for sigil creation.")
        path = sync.join_path("instanced_sheets", request.instance_id, "can_inscribe_sigils")
        return None, [sync.set_mutation(state, path, request.enabled)]

    await sync.apply_mutation(mutation, request_id=request.request_id)


def ensure_actor(state: State, instance_id: str, role: SessionRole, assigned: str | None) -> None:
    if role != "dm" and (role != "player" or assigned != instance_id):
        raise PermissionError("You can only use your assigned character.")
    if instance_id not in state.instanced_sheets:
        raise ValueError("Sigils require an existing character instance.")


def can_access(sigil: Sigil, instance_id: str | None) -> bool:
    return instance_id is not None and (
        sigil.owner_instance_id == instance_id or instance_id in sigil.access_instance_ids
    )


def require_sigil(state: State, sigil_id: str, role: SessionRole, assigned: str | None, *, manage: bool = False) -> Sigil:
    sigil = state.sigils.get(sigil_id)
    if sigil is None:
        raise ValueError("Sigil does not exist.")
    allowed = sigil.owner_instance_id == assigned if manage else can_access(sigil, assigned)
    if role != "dm" and not allowed:
        raise PermissionError("You do not have access to this sigil.")
    return sigil


def require_node(sigil: Sigil, node_id: str) -> SigilNode:
    for node in sigil.nodes:
        if node.id == node_id:
            return node
    raise ValueError("Sigil node does not exist.")


def validate_references(state: State, sigil: Sigil) -> None:
    if sigil.owner_instance_id not in state.instanced_sheets:
        raise ValueError("Sigil owner no longer exists.")
    if any(value not in state.instanced_sheets for value in sigil.access_instance_ids):
        raise ValueError("Sigil access references a missing character.")
    if sigil.item_relationship_id:
        bridge = state.instanced_sheets[sigil.owner_instance_id].items.get(sigil.item_relationship_id)
        if bridge is None or bridge.item_id not in state.items or bridge.count <= 0:
            raise ValueError("Sigil inventory item no longer exists.")
        if bridge.count != 1:
            raise ValueError("An inscribed inventory entry must contain exactly one item copy.")
    for node in sigil.nodes:
        if node.action_id is None:
            if node.mana_cost_step_ids or node.power_step_ids:
                raise ValueError("Sigil step references require an Action binding.")
            continue
        action = state.actions.get(node.action_id)
        if action is None:
            raise ValueError("Sigil references a missing Action.")
        steps = {step.step_id: step for step in action.steps}
        for step_id in node.mana_cost_step_ids:
            step = steps.get(step_id)
            if not isinstance(step, DecrementValueStep) or step.path != ["mana"] or step.target != "caster":
                raise ValueError("Mana casting costs must explicitly select caster mana decrement steps.")
        for step_id in node.power_step_ids:
            if not isinstance(steps.get(step_id), (SendRollStep, SendMessageStep, SetValueStep, IncrementValueStep, DecrementValueStep, ResolveDamageStep)):
                raise ValueError("Sigil power must select an output or numeric effect step.")


def signature(state: State, action_id: str) -> str:
    action = state.actions.get(action_id)
    if action is None:
        raise ValueError("Stored Action no longer exists.")
    if any(key not in state.formulas for key in action.referenced_formula_ids()):
        raise ValueError("Stored Action references a missing Formula.")
    payload = {"action": asdict(action), "formulas": {
        key: asdict(state.formulas[key]) for key in sorted(action.referenced_formula_ids())
    }}
    return sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def resolve_binding(state: State, sigil: Sigil, node: SigilNode, imbuer_id: str, role: SessionRole) -> tuple[runtime.RuntimeActor, runtime.ResolvedAction]:
    validate_references(state, sigil)
    actor = runtime.resolve_runtime_actor(imbuer_id, state)
    if actor.instance is None:
        raise ValueError("The original imbuer must be an existing character instance.")
    # A sigil grants execution access, but does not grant source-item formula context.
    action = state.actions.get(node.action_id)
    if action is None:
        raise ValueError("Select an existing Action for this node.")
    source_item = None
    source_key = None
    if runtime._action_requires_source_item(action, state):
        if sigil.owner_instance_id != imbuer_id or not sigil.item_relationship_id:
            raise ValueError("This Action requires the imbuer's referenced inventory item.")
        source_key = sigil.item_relationship_id
        bridge = actor.instance.items[source_key]
        source_item = state.items[bridge.item_id]
    return actor, runtime.ResolvedAction(action, source_item_bridge_key=source_key, source_item=source_item)


def mana_cost(state: State, sigil: Sigil, node: SigilNode, imbuer_id: str, role: SessionRole) -> int:
    actor, resolution = resolve_binding(state, sigil, node, imbuer_id, role)
    values: dict[str, float | int] = {}
    root = runtime.RuntimeFormulaContext(actor.sheet, actor.instance, resolution.action,
        resolution.source_item, resolution.source_item_bridge_key, state, values, include_gm_only=role == "dm")
    total = 0.0
    pending = set(node.mana_cost_step_ids)
    for step in resolution.action.steps:
        if not pending:
            break
        if isinstance(step, CalculateValueStep):
            values[step.variable_id] = runtime._evaluate_action_formula(state=state, actor=actor,
                formula_root=root, formula=step.value, action_id=resolution.action.id, step_id=step.step_id,
                source_item_relationship_id=resolution.source_item_bridge_key)
        elif step.step_id in pending:
            amount = runtime._resolve_action_numeric_value(state=state, actor=actor, formula_root=root,
                value=step.amount, action_id=resolution.action.id, step_id=step.step_id, action_values=values)
            if not isfinite(amount) or amount < 0:
                raise ValueError("Mana casting cost must be finite and nonnegative.")
            total += amount
            pending.remove(step.step_id)
    scaled = node.diameter * total
    if not isfinite(scaled):
        raise ValueError("Scaled mana cost must be finite.")
    return floor(scaled)


def sigil_op(state: State, sigil: Sigil) -> PatchOp:
    return sync.set_mutation(state, sync.join_path("sigils", sigil.id), sigil)


async def save(request: SaveSigil, role: SessionRole, assigned: str | None) -> None:
    def mutation(state: State) -> tuple[None, list[PatchOp]]:
        ensure_authoring(state, role, assigned)
        ensure_actor(state, request.owner_instance_id, role, assigned)
        old = state.sigils.get(request.sigil_id)
        if old:
            require_sigil(state, old.id, role, assigned, manage=True)
            if request.expected_revision != old.revision:
                raise ValueError("Sigil changed; reload before saving.")
            if old.owner_instance_id != request.owner_instance_id:
                raise ValueError("Sigil ownership cannot be changed by configuration edits.")
        elif request.expected_revision is not None:
            raise ValueError("Sigil was deleted; reload before saving.")
        nodes = [SigilNode(**node.model_dump()) for node in request.nodes]
        result = Sigil(request.sigil_id, request.owner_instance_id, nodes,
            request.access_instance_ids, request.item_relationship_id, (old.revision + 1) if old else 0)
        validate_references(state, result)
        if old:
            by_id = {node.id: node for node in nodes}
            for previous in old.nodes:
                current = by_id.get(previous.id)
                if previous.charge:
                    if current is None or any(getattr(current, key) != getattr(previous, key)
                        for key in ("action_id", "diameter", "mana_cost_step_ids", "power_step_ids")) or old.item_relationship_id != result.item_relationship_id:
                        raise ValueError("Discharge charged nodes before changing their spell configuration.")
                if current:
                    current.charge = deepcopy(previous.charge)
                    current.last_imbuer_instance_id = previous.last_imbuer_instance_id
        return None, [sigil_op(state, result)]
    await sync.apply_mutation(mutation, request_id=request.request_id)


async def manage(request: DeleteSigil | DuplicateSigil, role: SessionRole, assigned: str | None) -> None:
    def mutation(state: State) -> tuple[None, list[PatchOp]]:
        ensure_authoring(state, role, assigned)
        original = require_sigil(state, request.sigil_id, role, assigned, manage=True)
        if request.type == "delete_sigil":
            if request.expected_revision != original.revision:
                raise ValueError("Sigil changed; reload before deleting.")
            _, op = sync.remove_mutation(state, sync.join_path("sigils", original.id))
            return None, [op]
        result = deepcopy(original)
        result.id = f"sigil_{uuid4()}"
        result.revision = 0
        ids = {node.id: f"node_{uuid4()}" for node in result.nodes}
        for node in result.nodes:
            node.id = ids[node.id]
            node.parent_id = ids.get(node.parent_id)
            node.charge = None
            node.last_imbuer_instance_id = None
            if node.parent_id is None:
                node.name += " copy"
        validate_references(state, result)
        return None, [sigil_op(state, result)]
    await sync.apply_mutation(mutation, request_id=request.request_id)


async def imbue(request: ImbueSigil, role: SessionRole, assigned: str | None) -> None:
    def mutation(state: State) -> tuple[None, list[PatchOp]]:
        ensure_actor(state, request.instance_id, role, assigned)
        sigil = deepcopy(require_sigil(state, request.sigil_id, role, assigned))
        node = require_node(sigil, request.node_id)
        if node.charge:
            raise ValueError("Sigil node is already charged.")
        cost = mana_cost(state, sigil, node, request.instance_id, role)
        instance = state.instanced_sheets[request.instance_id]
        if instance.mana < cost:
            raise ValueError("Insufficient mana to imbue this sigil.")
        node.charge = SigilCharge(node.action_id, request.instance_id, signature(state, node.action_id), cost)
        node.last_imbuer_instance_id = request.instance_id
        sigil.revision += 1
        return None, [sync.set_mutation(state, sync.join_path("instanced_sheets", request.instance_id, "mana"), instance.mana - cost), sigil_op(state, sigil)]
    await sync.apply_mutation(mutation, request_id=request.request_id)


async def discharge(request: DischargeSigil, role: SessionRole, assigned: str | None) -> None:
    def mutation(state: State) -> tuple[None, list[PatchOp]]:
        ensure_actor(state, request.instance_id, role, assigned)
        sigil = deepcopy(require_sigil(state, request.sigil_id, role, assigned, manage=True))
        node = require_node(sigil, request.node_id)
        if node.charge is None:
            raise ValueError("Sigil node is uncharged.")
        node.charge = None
        sigil.revision += 1
        return None, [sigil_op(state, sigil)]
    await sync.apply_mutation(mutation, request_id=request.request_id)


def activation_binding(state: State, request: ActivateSigil, role: SessionRole, assigned: str | None) -> tuple[Sigil, SigilNode, runtime.RuntimeActor, runtime.ResolvedAction]:
    ensure_actor(state, request.instance_id, role, assigned)
    sigil = require_sigil(state, request.sigil_id, role, assigned)
    node = require_node(sigil, request.node_id)
    if node.charge is None:
        raise ValueError("Sigil node is uncharged.")
    if signature(state, node.charge.action_id) != node.charge.action_signature:
        raise ValueError("Stored Action or formula changed; discharge and recharge this node.")
    actor, resolution = resolve_binding(state, sigil, node, node.charge.imbuer_instance_id, role)
    return sigil, node, actor, resolution


async def activate(request: ActivateSigil, role: SessionRole, assigned: str | None) -> ActionExecuted:
    _, node, _, _ = activation_binding(StateSingleton.getState(), request, role, assigned)
    intent = PerformAction(type="perform_action", sheet_id=request.instance_id,
        action_id=node.action_id, visibility=request.visibility, roll_mode=request.roll_mode, request_id=request.request_id)
    return await runtime.perform_action(intent, actor_role=role, assigned_instance_id=assigned,
        sigil_request=request)


async def preview(request: PreviewSigil, role: SessionRole, assigned: str | None) -> SigilPreview:
    def query(state: State) -> SigilPreview:
        ensure_actor(state, request.instance_id, role, assigned)
        sigil = require_sigil(state, request.sigil_id, role, assigned)
        node = require_node(sigil, request.node_id)
        return SigilPreview(request_id=request.request_id, sigil_id=sigil.id, node_id=node.id,
            mana_cost=mana_cost(state, sigil, node, request.instance_id, role), multiplier=node.diameter)

    return await sync.read_state(query)
