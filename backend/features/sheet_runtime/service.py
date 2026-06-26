from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from backend.features.augmentations import service as augmentation_service
from backend.features.chat import service as chat_service
from backend.features.chat.schema import Roll20ChatMessage
from backend.features.formula_runtime.service import (
    evaluate_numeric_formula,
    normalize_numeric_result,
)
from backend.features.session.models import SessionRole
from backend.features.sheet_runtime.schema import (
    ActionExecuted,
    ActionRollMode,
    ActionVisibility,
    PerformAction,
)
from backend.features.state_sync.service import state_sync_service
from backend.state.models.action import (
    Action,
    ApplyAugmentationStep,
    ApplyConditionPresetStep,
    DecrementValueStep,
    GainProficiencyUseStep,
    IncrementValueStep,
    ResolveDamageStep,
    SendMessageStep,
    SetValueStep,
)
from backend.state.models.damage import (
    DamageType,
    damage_type_category,
    damage_type_resistance_key,
)
from backend.state.models.formula import Formula
from backend.state.models.sheet import InstancedSheet, Sheet
from backend.state.models.state import State
from backend.state.store import StateSingleton


def _state() -> State:
    return StateSingleton.getState()


def get_sheet(sheet_id: str, state: State | None = None) -> Sheet:
    current_state = _state() if state is None else state
    sheet = current_state.sheets.get(sheet_id)
    if sheet is None:
        raise ValueError(f"Sheet '{sheet_id}' does not exist.")
    return sheet


@dataclass(frozen=True)
class RuntimeActor:
    actor_id: str
    sheet_id: str
    sheet: Sheet
    instance: InstancedSheet | None = None

    @property
    def mutation_root(self) -> str:
        if self.instance is None:
            return "sheets"
        return "instanced_sheets"


class RuntimeFormulaContext:
    def __init__(self, sheet: Sheet, instance: InstancedSheet | None) -> None:
        self._sheet = sheet
        self._instance = instance

    def __getattr__(self, name: str) -> Any:
        if self._instance is not None and hasattr(self._instance, name):
            return getattr(self._instance, name)
        return getattr(self._sheet, name)


def resolve_runtime_actor(sheet_id: str, state: State | None = None) -> RuntimeActor:
    current_state = _state() if state is None else state
    sheet = current_state.sheets.get(sheet_id)
    if sheet is not None:
        return RuntimeActor(actor_id=sheet_id, sheet_id=sheet_id, sheet=sheet)

    instance = current_state.instanced_sheets.get(sheet_id)
    if instance is None:
        raise ValueError(f"Sheet or instance '{sheet_id}' does not exist.")

    parent_sheet = current_state.sheets.get(instance.parent_id)
    if parent_sheet is None:
        raise ValueError(
            f"Instance '{sheet_id}' references missing parent sheet '{instance.parent_id}'."
        )
    return RuntimeActor(
        actor_id=sheet_id,
        sheet_id=instance.parent_id,
        sheet=parent_sheet,
        instance=instance,
    )


def _resolve_value_container(root: Any, path: list[str]) -> tuple[Any, str]:
    if not path:
        raise ValueError("Mutation path must not be empty.")

    current = root
    for idx, branch in enumerate(path[:-1]):
        if isinstance(current, dict):
            if branch not in current:
                raise ValueError(
                    f"Mutation branch '{branch}' which is idx {idx} does not exist."
                )
            current = current[branch]
            continue

        current = getattr(current, branch, None)
        if current is None:
            raise ValueError(
                f"Mutation branch '{branch}' which is idx {idx} does not exist."
            )

    return current, path[-1]


def _apply_set_value(
    root: dict[str, Any],
    path: list[str],
    value: float | int,
) -> None:
    container, leaf = _resolve_value_container(root, path)
    if isinstance(container, dict):
        container[leaf] = value
        return
    if not hasattr(container, leaf):
        raise ValueError(f"Mutation branch '{leaf}' does not exist.")
    setattr(container, leaf, value)


def _resolve_action(
    sheet: Sheet,
    action_id: str,
    *,
    actor_role: SessionRole,
    state: State | None = None,
) -> Action:
    current_state = _state() if state is None else state
    action = current_state.actions.get(action_id)
    if action is None:
        raise ValueError(f"Action '{action_id}' does not exist.")

    if actor_role == "dm":
        return action

    sheet_action_bridges = sheet.actions
    if sheet_action_bridges:
        for bridge in sheet_action_bridges.values():
            if bridge.entry_id == action_id:
                return action
        raise ValueError(f"Sheet '{sheet.id}' does not reference action '{action_id}'.")

    raise ValueError(
        f"Sheet '{sheet.id}' does not reference action '{action_id}'."
    )


def _validate_caster_target(target: str) -> None:
    if target != "caster":
        raise ValueError(f"Unsupported runtime action target '{target}'.")


def _positive_int_amount(amount: float | int, *, label: str) -> int:
    if amount <= 0:
        raise ValueError(f"{label} must be greater than 0.")
    if not isinstance(amount, int):
        raise ValueError(f"{label} must be a whole number.")
    return amount


def _proficiency_bridge_key(actor: RuntimeActor, proficiency_id: str) -> str:
    for bridge_key, bridge in actor.sheet.proficiencies.items():
        if (
            bridge_key == proficiency_id
            or bridge.prof_id == proficiency_id
            or bridge.relationship_id == proficiency_id
        ):
            return bridge_key
    raise ValueError(
        f"Sheet '{actor.sheet.id}' does not reference proficiency '{proficiency_id}'."
    )


def _required_instance_id(actor: RuntimeActor, step_type: str) -> str:
    if actor.instance is None:
        raise ValueError(f"{step_type} steps require an instanced sheet.")
    return actor.actor_id


def _augmentation_mutation_summary(
    augmentation_id: str,
    operation: str,
    result_operation: str,
    reason: str | None,
) -> str:
    summary = f"augmentations.{augmentation_id} {operation}:{result_operation}"
    if reason is not None:
        summary += f":{reason}"
    return summary


def _condition_mutation_summary(
    condition_id: str,
    operation: str,
    result_operation: str,
    reason: str | None,
) -> str:
    summary = f"conditions.{condition_id} {operation}:{result_operation}"
    if reason is not None:
        summary += f":{reason}"
    return summary


def _numeric_path_value(root: Any, path: list[str], state_path: str) -> float | int:
    container, leaf = _resolve_value_container(root, path)
    if isinstance(container, dict):
        if leaf not in container:
            raise ValueError(f"State path {state_path} does not exist.")
        current_value = container[leaf]
    elif hasattr(container, leaf):
        current_value = getattr(container, leaf)
    else:
        raise ValueError(f"State path {state_path} does not exist.")

    if not isinstance(current_value, int | float):
        raise ValueError(f"State path {state_path} is not numeric.")
    return current_value


def _target_root(actor: RuntimeActor) -> Sheet | InstancedSheet:
    if actor.instance is None:
        return actor.sheet
    return actor.instance


def _effective_damage_resistance(
    actor: RuntimeActor,
    damage_type: DamageType,
) -> float:
    category = damage_type_category(damage_type)
    resistance_key = damage_type_resistance_key(damage_type)
    resistance = (
        actor.sheet.resistances.resistance
        + getattr(actor.sheet.resistances, category)
        + getattr(actor.sheet.resistances, resistance_key)
    )
    if actor.instance is not None:
        resistance += (
            actor.instance.resistances.resistance
            + getattr(actor.instance.resistances, category)
            + getattr(actor.instance.resistances, resistance_key)
        )
    return min(resistance, 1.0)


def _resolve_damage_amount(
    *,
    actor: RuntimeActor,
    formula_root: Any,
    damage_type: DamageType,
    amount: Formula,
) -> float | int:
    raw_damage = evaluate_numeric_formula(formula_root, amount)
    if raw_damage < 0:
        raise ValueError("Damage amount must be greater than or equal to 0.")
    resistance = _effective_damage_resistance(actor, damage_type)
    damage_taken = raw_damage - (raw_damage * resistance)
    return normalize_numeric_result(max(0, damage_taken))


def _bounded_numeric_result(
    value: float | int,
    *,
    formula_root: Any,
    min_value: Formula | None,
    max_value: Formula | None,
    on_min_violation: str,
    on_max_violation: str,
    state_path: str,
) -> float | int:
    result = value
    if min_value is not None:
        minimum = evaluate_numeric_formula(formula_root, min_value)
        if result < minimum:
            if on_min_violation == "reject":
                raise ValueError(
                    f"State path {state_path} would be below minimum {minimum}."
                )
            result = minimum

    if max_value is not None:
        maximum = evaluate_numeric_formula(formula_root, max_value)
        if result > maximum:
            if on_max_violation == "reject":
                raise ValueError(
                    f"State path {state_path} would be above maximum {maximum}."
                )
            result = maximum

    return normalize_numeric_result(result)


def _has_bounds(step: SetValueStep | IncrementValueStep | DecrementValueStep) -> bool:
    return step.min_value is not None or step.max_value is not None


def _resolve_allowed_runtime_actor(
    request: PerformAction,
    *,
    actor_role: SessionRole,
    assigned_instance_id: str | None = None,
) -> RuntimeActor:
    if request.target_sheet_id is not None:
        raise ValueError(
            "Target sheet execution is not supported for MVP; "
            "actions can only affect the acting sheet or instance."
        )

    actor = resolve_runtime_actor(request.sheet_id)
    if actor.instance is None and actor_role != "dm":
        raise ValueError("Players can only execute actions against an instanced sheet.")
    if actor_role == "player":
        if assigned_instance_id is None:
            raise PermissionError(
                "Claim a sheet access code before editing a player sheet."
            )
        if actor.actor_id != assigned_instance_id:
            raise PermissionError("You can only edit your assigned sheet instance.")
    return actor


ROLL20_ROLL_PATTERN = re.compile(
    r"^(?P<label>.*?)(?P<command>/r\s+)(?P<expression>.+)$",
    flags=re.IGNORECASE,
)


def format_roll20_message(
    message: str,
    *,
    roll_mode: ActionRollMode,
    visibility: ActionVisibility,
) -> str:
    match = ROLL20_ROLL_PATTERN.match(message)
    if match is None:
        return f"/w gm {message}" if visibility == "gm_only" else message

    label = match.group("label").rstrip()
    expression = match.group("expression").strip()
    if roll_mode == "advantage":
        expression = f"{{{expression}, {expression}}}kh1"
    elif roll_mode == "disadvantage":
        expression = f"{{{expression}, {expression}}}kl1"

    label_prefix = f"{label} " if label else ""
    if visibility == "gm_only":
        return f"/w gm {label_prefix}[[{expression}]]"

    if label:
        return f"{label} [[{expression}]]"
    return f"/r {expression}"


def validate_action_runtime_parameters(
    request: PerformAction,
    *,
    actor_role: SessionRole,
    action: Action,
) -> None:
    if request.visibility == "gm_only" and actor_role != "dm":
        raise PermissionError("Only a DM can send GM-only action output.")

    if request.roll_mode == "normal":
        return

    emits_roll = any(
        isinstance(step, SendMessageStep)
        and ROLL20_ROLL_PATTERN.match(step.message.text) is not None
        for step in action.steps
    )
    if not emits_roll:
        raise ValueError(
            "Advantage/disadvantage requires an action with a Roll20 /r expression."
        )


async def perform_action(
    request: PerformAction,
    *,
    actor_role: SessionRole = "player",
    assigned_instance_id: str | None = None,
) -> ActionExecuted | None:
    actor = _resolve_allowed_runtime_actor(
        request,
        actor_role=actor_role,
        assigned_instance_id=assigned_instance_id,
    )
    action = _resolve_action(
        actor.sheet,
        request.action_id,
        actor_role=actor_role,
    )
    validate_action_runtime_parameters(
        request,
        actor_role=actor_role,
        action=action,
    )
    steps = action.steps

    if any(isinstance(step, SendMessageStep) for step in steps):
        if not await chat_service.roll20_chat_bridge.is_connected():
            raise ValueError("Roll20 chat bridge is not connected.")

    def mutation(state: State) -> tuple[tuple[list[str], list[str], bool], list[Any]]:
        current_actor = resolve_runtime_actor(request.sheet_id, state=state)
        current_action = _resolve_action(
            current_actor.sheet,
            request.action_id,
            actor_role=actor_role,
            state=state,
        )
        current_steps = current_action.steps
        formula_root = RuntimeFormulaContext(
            current_actor.sheet, current_actor.instance
        )

        applied_mutations: list[str] = []
        emitted_messages: list[str] = []
        ops: list[Any] = []

        for step in current_steps:
            if isinstance(step, SendMessageStep):
                message = step.message.expand_formula(formula_root)
                emitted_messages.append(
                    format_roll20_message(
                        message,
                        roll_mode=request.roll_mode,
                        visibility=request.visibility,
                    )
                )
                continue

            if isinstance(step, SetValueStep):
                _validate_caster_target(step.target)
                result = evaluate_numeric_formula(formula_root, step.value)
                path = state_sync_service.join_path(
                    current_actor.mutation_root, current_actor.actor_id, *step.path
                )
                result = _bounded_numeric_result(
                    result,
                    formula_root=formula_root,
                    min_value=step.min_value,
                    max_value=step.max_value,
                    on_min_violation=step.on_min_violation,
                    on_max_violation=step.on_max_violation,
                    state_path=path,
                )
                op = state_sync_service.set_mutation(state, path, result)
                ops.append(op)
                applied_mutations.append(".".join(step.path) + f"={result}")
                continue

            if isinstance(step, IncrementValueStep):
                _validate_caster_target(step.target)
                amount = evaluate_numeric_formula(formula_root, step.amount)
                path = state_sync_service.join_path(
                    current_actor.mutation_root, current_actor.actor_id, *step.path
                )
                if _has_bounds(step):
                    current_value = _numeric_path_value(
                        _target_root(current_actor),
                        step.path,
                        path,
                    )
                    result = _bounded_numeric_result(
                        current_value + amount,
                        formula_root=formula_root,
                        min_value=step.min_value,
                        max_value=step.max_value,
                        on_min_violation=step.on_min_violation,
                        on_max_violation=step.on_max_violation,
                        state_path=path,
                    )
                    op = state_sync_service.set_mutation(state, path, result)
                    applied_mutations.append(".".join(step.path) + f"={result}")
                    ops.append(op)
                    continue

                op = state_sync_service.increment_mutation(state, path, amount)
                ops.append(op)
                applied_mutations.append(".".join(step.path) + f"+={amount}")
                continue

            if isinstance(step, DecrementValueStep):
                _validate_caster_target(step.target)
                amount = evaluate_numeric_formula(formula_root, step.amount)
                path = state_sync_service.join_path(
                    current_actor.mutation_root, current_actor.actor_id, *step.path
                )
                if _has_bounds(step):
                    current_value = _numeric_path_value(
                        _target_root(current_actor),
                        step.path,
                        path,
                    )
                    result = _bounded_numeric_result(
                        current_value - amount,
                        formula_root=formula_root,
                        min_value=step.min_value,
                        max_value=step.max_value,
                        on_min_violation=step.on_min_violation,
                        on_max_violation=step.on_max_violation,
                        state_path=path,
                    )
                    op = state_sync_service.set_mutation(state, path, result)
                    applied_mutations.append(".".join(step.path) + f"={result}")
                    ops.append(op)
                    continue

                op = state_sync_service.decrement_mutation(state, path, amount)
                ops.append(op)
                applied_mutations.append(".".join(step.path) + f"-={amount}")
                continue

            if isinstance(step, ResolveDamageStep):
                _validate_caster_target(step.target)
                _required_instance_id(current_actor, "Resolve damage")
                path = state_sync_service.join_path(
                    "instanced_sheets",
                    current_actor.actor_id,
                    "health",
                )
                current_health = _numeric_path_value(
                    _target_root(current_actor),
                    ["health"],
                    path,
                )
                damage_taken = _resolve_damage_amount(
                    actor=current_actor,
                    formula_root=formula_root,
                    damage_type=step.damage_type,
                    amount=step.amount,
                )
                result = normalize_numeric_result(
                    max(0, current_health - damage_taken)
                )
                op = state_sync_service.set_mutation(state, path, result)
                ops.append(op)
                resistance = _effective_damage_resistance(
                    current_actor,
                    step.damage_type,
                )
                applied_mutations.append(
                    f"health={result};damage={damage_taken};"
                    f"type={step.damage_type};resistance={resistance}"
                )
                continue

            if isinstance(step, GainProficiencyUseStep):
                _validate_caster_target(step.target)
                amount = _positive_int_amount(
                    evaluate_numeric_formula(formula_root, step.amount),
                    label="Proficiency use gain amount",
                )
                bridge_key = _proficiency_bridge_key(
                    current_actor, step.proficiency_id
                )
                path = state_sync_service.join_path(
                    "sheets",
                    current_actor.sheet_id,
                    "proficiencies",
                    bridge_key,
                    "use_count",
                )
                op = state_sync_service.increment_mutation(state, path, amount)
                ops.append(op)
                applied_mutations.append(
                    f"proficiencies.{bridge_key}.use_count+={amount}"
                )
                continue

            if isinstance(step, ApplyAugmentationStep):
                _validate_caster_target(step.target)
                instance_id = _required_instance_id(
                    current_actor,
                    "Apply augmentation",
                )
                augmentation = state.augmentations.get(step.augmentation_id)
                if augmentation is None:
                    raise ValueError(
                        f"Augmentation '{step.augmentation_id}' does not exist."
                    )
                if augmentation.target.root != "instance":
                    raise ValueError(
                        "Action augmentation steps can only target the acting instance."
                    )
                if step.operation == "apply":
                    result, result_ops = (
                        augmentation_service.apply_augmentation_mutation(
                            state,
                            step.augmentation_id,
                            instance_id=instance_id,
                        )
                    )
                else:
                    result, result_ops = (
                        augmentation_service.remove_augmentation_mutation(
                            state,
                            step.augmentation_id,
                            instance_id=instance_id,
                        )
                    )
                ops.extend(result_ops)
                applied_mutations.append(
                    _augmentation_mutation_summary(
                        step.augmentation_id,
                        step.operation,
                        result.operation,
                        result.reason,
                    )
                )
                continue

            if isinstance(step, ApplyConditionPresetStep):
                _validate_caster_target(step.target)
                instance_id = _required_instance_id(
                    current_actor,
                    "Apply condition preset",
                )
                if step.operation == "apply":
                    result, result_ops = (
                        augmentation_service.apply_condition_preset_mutation(
                            state,
                            instance_id=instance_id,
                            condition_id=step.condition_id,
                        )
                    )
                else:
                    result, result_ops = (
                        augmentation_service.remove_condition_preset_mutation(
                            state,
                            instance_id=instance_id,
                            condition_id=step.condition_id,
                        )
                    )
                ops.extend(result_ops)
                applied_mutations.append(
                    _condition_mutation_summary(
                        step.condition_id,
                        step.operation,
                        result.operation,
                        result.reason,
                    )
                )
                continue

            raise ValueError(
                f"Unsupported runtime action step '{step.__class__.__name__}'."
            )

        return (applied_mutations, emitted_messages), ops

    applied_mutations, emitted_messages = (
        await state_sync_service.apply_mutation(
            mutation,
            request_id=request.request_id,
        )
    )

    for message in emitted_messages:
        await chat_service.roll20_chat_bridge.send(
            Roll20ChatMessage(
                message_id=str(uuid4()),
                message=message,
                request_id=request.request_id,
            )
        )

    return ActionExecuted(
        response_id=None,
        sheet_id=request.sheet_id,
        action_id=request.action_id,
        applied_mutations=applied_mutations,
        emitted_messages=emitted_messages,
        request_id=request.request_id,
    )
